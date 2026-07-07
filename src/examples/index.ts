import type { Language } from '../types/trace';

export interface Example {
  id: string;
  title: string;
  blurb: string;
  language: Language;
  code: string;
}

// A small seed set — each chosen to show a specific visual. The curated
// ~20–30 placement-prep curriculum (PLAN.md §9.6) grows from here.
export const examples: Example[] = [
  {
    id: 'fibonacci',
    title: 'Fibonacci',
    blurb: 'A list grows as the loop runs',
    language: 'python',
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
    id: 'two-sum',
    title: 'Two sum',
    blurb: 'A dict fills up as we scan',
    language: 'python',
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
    id: 'bubble-sort',
    title: 'Bubble sort',
    blurb: 'Watch elements swap into place',
    language: 'python',
    code: `def bubble_sort(a):
    for i in range(len(a)):
        for j in range(len(a) - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a


print(bubble_sort([5, 2, 9, 1, 6, 3]))
`,
  },
  {
    id: 'js-fibonacci',
    title: 'Fibonacci',
    blurb: 'An array grows as the loop runs',
    language: 'javascript',
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
    id: 'js-two-sum',
    title: 'Two sum',
    blurb: 'An object fills up as we scan',
    language: 'javascript',
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
    id: 'js-bubble-sort',
    title: 'Bubble sort',
    blurb: 'Watch elements swap into place',
    language: 'javascript',
    code: `function bubbleSort(a) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        const tmp = a[j];
        a[j] = a[j + 1];
        a[j + 1] = tmp;
      }
    }
  }
  return a;
}

console.log(bubbleSort([5, 2, 9, 1, 6, 3]));
`,
  },
];

export const examplesFor = (language: Language): Example[] =>
  examples.filter((e) => e.language === language);

export const defaultExampleFor = (language: Language): Example => examplesFor(language)[0];

export const defaultExample = examples[0];
