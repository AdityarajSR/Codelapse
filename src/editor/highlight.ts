import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Brand syntax palette — violet/cyan family instead of the stock oneDark
 * orange/red, so the editor reads as part of Codelapse, not a generic IDE.
 */
const style = HighlightStyle.define(
  [
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword], color: '#a99bff' },
    { tag: [t.string, t.special(t.string), t.docString], color: '#7ee7fb' },
    { tag: [t.number, t.bool, t.null, t.atom], color: '#33d6f5' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#c9beff' },
    { tag: t.definition(t.variableName), color: '#f1f1f8' },
    { tag: t.comment, color: '#606183', fontStyle: 'italic' },
    { tag: [t.className, t.typeName, t.namespace], color: '#ffc24b' },
    { tag: [t.operator, t.compareOperator, t.arithmeticOperator], color: '#9fa0bd' },
    { tag: [t.punctuation, t.bracket], color: '#8b8ca8' },
    { tag: t.propertyName, color: '#b7e3ff' },
    { tag: t.variableName, color: '#e6e6f2' },
    { tag: [t.self, t.special(t.variableName)], color: '#e86bd8' },
  ],
  { themeType: 'dark' },
);

export const codelapseHighlight = syntaxHighlighting(style);
