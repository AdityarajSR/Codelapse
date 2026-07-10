import type { Language } from '../types/trace';

export interface Example {
  id: string;
  title: string;
  blurb: string;
  language: Language;
  /** Dropdown section — consecutive examples sharing a group get a heading. */
  group: string;
  code: string;
}

/**
 * The seed curriculum. Each example is chosen for a DIFFERENT stage
 * choreography, so students discover a new animation pattern every time:
 *
 * - fibonacci        boxes pop in one by one (append cascade)
 * - bubble sort      neighbours arc over each other, i/j pointers crawl
 * - selection sort   the minimum FLIES home across the whole array
 * - insertion sort   values shift right in a wave, then the key drops in
 * - reverse          lo/hi pointers converge, swaps span the full width
 * - binary search    the array never moves — lo/mid/hi do the dancing
 * - two sum          a dict fills up as the scan advances
 * - brackets         a stack breathes: push… push… pop… pop
 * - char count       dict keys appear once, their values tick upward
 *
 * Sort inputs use values ≥ array length so value-typed locals (like `key`)
 * never masquerade as index pointers on the stage.
 */
export const examples: Example[] = [
  /* ------------------------------------------------------------ python -- */
  {
    id: 'fibonacci',
    title: 'Fibonacci',
    blurb: 'A list grows as the loop runs',
    language: 'python',
    group: 'Build up',
    code: `def fib(n):
    seq = [0, 1]
    for i in range(2, n):
        seq.append(seq[i - 1] + seq[i - 2])
        print(seq[-1])
    return seq


fib(8)
`,
  },
  {
    id: 'bubble-sort',
    title: 'Bubble sort',
    blurb: 'Neighbours swap their way to sorted',
    language: 'python',
    group: 'Sorting',
    code: `def bubble_sort(a):
    for i in range(len(a)):
        for j in range(len(a) - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a


print(bubble_sort([50, 20, 90, 10, 60, 30]))
`,
  },
  {
    id: 'selection-sort',
    title: 'Selection sort',
    blurb: 'Watch the minimum fly home',
    language: 'python',
    group: 'Sorting',
    code: `def selection_sort(a):
    for i in range(len(a)):
        m = i
        for j in range(i + 1, len(a)):
            if a[j] < a[m]:
                m = j
        a[i], a[m] = a[m], a[i]
    return a


print(selection_sort([70, 30, 90, 10, 60, 20]))
`,
  },
  {
    id: 'insertion-sort',
    title: 'Insertion sort',
    blurb: 'Values shift right, then the key drops in',
    language: 'python',
    group: 'Sorting',
    code: `def insertion_sort(a):
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
    return a


print(insertion_sort([47, 23, 68, 12, 95, 31]))
`,
  },
  {
    id: 'reverse',
    title: 'Reverse in place',
    blurb: 'Two pointers close in, swapping the ends',
    language: 'python',
    group: 'Two pointers',
    code: `def reverse(a):
    lo, hi = 0, len(a) - 1
    while lo < hi:
        a[lo], a[hi] = a[hi], a[lo]
        lo += 1
        hi -= 1
    return a


print(reverse([10, 20, 30, 40, 50, 60, 70]))
`,
  },
  {
    id: 'binary-search',
    title: 'Binary search',
    blurb: 'The array holds still — lo, mid and hi dance',
    language: 'python',
    group: 'Searching',
    code: `def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


print(binary_search([11, 25, 34, 48, 52, 66, 73, 89], 66))
`,
  },
  {
    id: 'two-sum',
    title: 'Two sum',
    blurb: 'A dict fills up as we scan',
    language: 'python',
    group: 'Searching',
    code: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []


print(two_sum([2, 7, 11, 15], 9))
`,
  },
  {
    id: 'brackets',
    title: 'Balanced brackets',
    blurb: 'A stack breathes: push, push, pop, pop',
    language: 'python',
    group: 'Stacks & dicts',
    code: `def balanced(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif stack and stack[-1] == pairs[ch]:
            stack.pop()
        else:
            return False
    return len(stack) == 0


print(balanced('{[()()]}'))
`,
  },
  {
    id: 'char-count',
    title: 'Character count',
    blurb: 'Keys appear once, their counts tick upward',
    language: 'python',
    group: 'Stacks & dicts',
    code: `def char_count(word):
    counts = {}
    for ch in word:
        counts[ch] = counts.get(ch, 0) + 1
    return counts


print(char_count('codelapse'))
`,
  },

  /* -------------------------------------------------------- javascript -- */
  {
    id: 'js-fibonacci',
    title: 'Fibonacci',
    blurb: 'An array grows as the loop runs',
    language: 'javascript',
    group: 'Build up',
    code: `function fib(n) {
  const seq = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
    console.log(seq[seq.length - 1]);
  }
  return seq;
}

fib(8);
`,
  },
  {
    id: 'js-bubble-sort',
    title: 'Bubble sort',
    blurb: 'Neighbours swap their way to sorted',
    language: 'javascript',
    group: 'Sorting',
    code: `function bubbleSort(a) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
      }
    }
  }
  return a;
}

console.log(bubbleSort([50, 20, 90, 10, 60, 30]));
`,
  },
  {
    id: 'js-selection-sort',
    title: 'Selection sort',
    blurb: 'Watch the minimum fly home',
    language: 'javascript',
    group: 'Sorting',
    code: `function selectionSort(a) {
  for (let i = 0; i < a.length; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) {
      if (a[j] < a[m]) m = j;
    }
    [a[i], a[m]] = [a[m], a[i]];
  }
  return a;
}

console.log(selectionSort([70, 30, 90, 10, 60, 20]));
`,
  },
  {
    id: 'js-insertion-sort',
    title: 'Insertion sort',
    blurb: 'Values shift right, then the key drops in',
    language: 'javascript',
    group: 'Sorting',
    code: `function insertionSort(a) {
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}

console.log(insertionSort([47, 23, 68, 12, 95, 31]));
`,
  },
  {
    id: 'js-reverse',
    title: 'Reverse in place',
    blurb: 'Two pointers close in, swapping the ends',
    language: 'javascript',
    group: 'Two pointers',
    code: `function reverse(a) {
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi) {
    [a[lo], a[hi]] = [a[hi], a[lo]];
    lo++;
    hi--;
  }
  return a;
}

console.log(reverse([10, 20, 30, 40, 50, 60, 70]));
`,
  },
  {
    id: 'js-binary-search',
    title: 'Binary search',
    blurb: 'The array holds still — lo, mid and hi dance',
    language: 'javascript',
    group: 'Searching',
    code: `function binarySearch(a, target) {
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

console.log(binarySearch([11, 25, 34, 48, 52, 66, 73, 89], 66));
`,
  },
  {
    id: 'js-two-sum',
    title: 'Two sum',
    blurb: 'An object fills up as we scan',
    language: 'javascript',
    group: 'Searching',
    code: `function twoSum(nums, target) {
  const seen = {};
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (need in seen) {
      return [seen[need], i];
    }
    seen[nums[i]] = i;
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9));
`,
  },
  {
    id: 'js-brackets',
    title: 'Balanced brackets',
    blurb: 'A stack breathes: push, push, pop, pop',
    language: 'javascript',
    group: 'Stacks & dicts',
    code: `function balanced(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const ch of s) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (stack[stack.length - 1] === pairs[ch]) stack.pop();
    else return false;
  }
  return stack.length === 0;
}

console.log(balanced('{[()()]}'));
`,
  },
  {
    id: 'js-char-count',
    title: 'Character count',
    blurb: 'Keys appear once, their counts tick upward',
    language: 'javascript',
    group: 'Stacks & dicts',
    code: `function charCount(word) {
  const counts = {};
  for (const ch of word) {
    counts[ch] = (counts[ch] || 0) + 1;
  }
  return counts;
}

console.log(charCount('codelapse'));
`,
  },
];

export const examplesFor = (language: Language): Example[] =>
  examples.filter((e) => e.language === language);

export const defaultExampleFor = (language: Language): Example => examplesFor(language)[0];

export const defaultExample = examples[0];
