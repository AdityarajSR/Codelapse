export interface Example {
  id: string;
  title: string;
  blurb: string;
  code: string;
}

// A small seed set — each chosen to show a specific visual. The curated
// ~20–30 placement-prep curriculum (PLAN.md §9.6) grows from here.
export const examples: Example[] = [
  {
    id: 'fibonacci',
    title: 'Fibonacci',
    blurb: 'A list grows as the loop runs',
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
    code: `def bubble_sort(a):
    for i in range(len(a)):
        for j in range(len(a) - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a


print(bubble_sort([5, 2, 9, 1, 6, 3]))
`,
  },
];

export const defaultExample = examples[0];
