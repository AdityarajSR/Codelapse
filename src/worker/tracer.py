# Codelapse — Python line tracer.
#
# Runs the user's program under sys.settrace and records a per-line snapshot
# (line, locals, call stack, stdout delta) into a flat list. Playback is just
# walking that list, so stepping backward is free. Values are capped for size,
# steps are capped to survive infinite loops, and stdout is stored as a DELTA
# per step (not cumulative) to avoid O(n^2) memory.
#
# Returns a dict matching the Trace envelope in src/types/trace.ts (the JS side
# stamps schemaVersion / language / site / runtimeVersion).

import io
import sys
import traceback

MAX_STEPS = 4000
MAX_REPR = 140
MAX_ITEMS = 60
MAX_OUTPUT = 200_000
FILENAME = "<codelapse>"


class _StopTrace(BaseException):
    """Raised to unwind execution when a budget is exceeded. Subclasses
    BaseException so ordinary `except Exception` in user code won't swallow it."""


def _safe_repr(v, depth=0):
    try:
        if isinstance(v, str):
            s = v if len(v) <= MAX_REPR else v[:MAX_REPR] + "…"
            return repr(s)
        if isinstance(v, bool) or v is None:
            return repr(v)
        if isinstance(v, (int, float, complex)):
            return repr(v)
        if depth >= 3:
            return "…"
        if isinstance(v, (list, tuple)):
            items = [_safe_repr(x, depth + 1) for x in list(v)[:MAX_ITEMS]]
            more = "" if len(v) <= MAX_ITEMS else f", …(+{len(v) - MAX_ITEMS})"
            o, c = ("[", "]") if isinstance(v, list) else ("(", ")")
            return o + ", ".join(items) + more + c
        if isinstance(v, dict):
            pairs = [
                f"{_safe_repr(k, depth + 1)}: {_safe_repr(val, depth + 1)}"
                for k, val in list(v.items())[:MAX_ITEMS]
            ]
            more = "" if len(v) <= MAX_ITEMS else f", …(+{len(v) - MAX_ITEMS})"
            return "{" + ", ".join(pairs) + more + "}"
        if isinstance(v, (set, frozenset)):
            items = [_safe_repr(x, depth + 1) for x in list(v)[:MAX_ITEMS]]
            return "{" + ", ".join(items) + "}"
        r = repr(v)
        return r if len(r) <= MAX_REPR else r[:MAX_REPR] + "…"
    except Exception:
        return "<unreprable>"


def _kind(v):
    if isinstance(v, str):
        return "string"
    if isinstance(v, (list, tuple)):
        return "array"
    if isinstance(v, dict):
        return "dict"
    if isinstance(v, (set, frozenset)):
        return "set"
    if isinstance(v, bool) or v is None or isinstance(v, (int, float, complex)):
        return "scalar"
    return "object"


def run_trace(source):
    steps = []
    out = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = out
    ctx = {"consumed": 0, "capped": None}  # chars of stdout already recorded

    try:
        code = compile(source, FILENAME, "exec")
    except SyntaxError as e:
        sys.stdout = old_stdout
        return {
            "status": "compile-error",
            "diagnostics": [
                {
                    "type": "SyntaxError",
                    "message": str(e.msg),
                    "line": e.lineno,
                    "col": e.offset,
                }
            ],
            "steps": [],
        }

    glb = {"__name__": "__main__"}

    def snapshot(frame, event):
        cur = out.getvalue()
        delta = cur[ctx["consumed"] :]
        ctx["consumed"] = len(cur)

        loc = {}
        for name, value in list(frame.f_locals.items()):
            if name.startswith("__"):
                continue
            loc[name] = {"repr": _safe_repr(value), "type": type(value).__name__, "kind": _kind(value)}

        stack = []
        f = frame
        while f is not None and f.f_code.co_filename == FILENAME:
            stack.append({"funcName": f.f_code.co_name, "line": f.f_lineno})
            f = f.f_back

        steps.append(
            {
                "stepIndex": len(steps),
                "line": frame.f_lineno,
                "funcName": frame.f_code.co_name,
                "event": event,
                "callStack": stack,
                "locals": loc,
                "stdout": delta,
            }
        )

    def tracer(frame, event, arg):
        # Only trace the user's own code; return None so library internals
        # aren't line-traced (faster and less noise).
        if frame.f_code.co_filename != FILENAME:
            return None
        if len(out.getvalue()) > MAX_OUTPUT:
            ctx["capped"] = "output-cap"
            raise _StopTrace()
        if len(steps) >= MAX_STEPS:
            ctx["capped"] = "step-cap"
            raise _StopTrace()
        if event in ("line", "call", "return"):
            snapshot(frame, event)
        return tracer

    sys.settrace(tracer)
    try:
        exec(code, glb, glb)
    except _StopTrace:
        pass
    except BaseException as e:  # user program crashed — keep the partial trace
        sys.settrace(None)
        tb = traceback.extract_tb(sys.exc_info()[2])
        err_line = None
        for fr in reversed(tb):
            if fr.filename == FILENAME:
                err_line = fr.lineno
                break
        cur = out.getvalue()
        trailing = cur[ctx["consumed"] :]
        sys.stdout = old_stdout
        return {
            "status": "runtime-error",
            "diagnostics": [{"type": type(e).__name__, "message": str(e), "line": err_line}],
            "steps": steps,
            "finalStdout": trailing,
        }
    finally:
        sys.settrace(None)
        sys.stdout = old_stdout

    return {
        "status": ctx["capped"] or "ok",
        "diagnostics": [],
        "steps": steps,
    }
