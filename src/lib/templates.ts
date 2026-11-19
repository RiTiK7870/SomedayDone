import type { Category } from '../types';

export interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  category: Category;
  steps: string[];
}

// Ready-made goals with steps. No AI needed, so they never use API quota.
export const TEMPLATES: GoalTemplate[] = [
  {
    id: 'learn-dsa',
    title: 'Learn DSA',
    description: 'Build data structures and algorithm skills step by step.',
    category: 'Learning',
    steps: [
      'Learn Big-O notation',
      'Solve 10 easy array and string problems',
      'Learn linked lists and solve 5 problems',
      'Practice stacks and queues',
      'Study recursion and solve 5 problems',
      'Learn trees and tree traversals',
      'Practice graphs with BFS and DFS',
      'Solve 3 medium problems each week',
      'Do one mock interview with a friend',
    ],
  },
  {
    id: 'run-5k',
    title: 'Run a 5K',
    description: 'Go from walking to running five kilometres without stopping.',
    category: 'Fitness',
    steps: [
      'Get running shoes that fit well',
      'Walk-run for 20 minutes, three times a week',
      'Run 2 km without stopping',
      'Run 4 km without stopping',
      'Run 5 km at an easy pace',
      'Sign up for a local 5K event',
    ],
  },
  {
    id: 'cook-five-dishes',
    title: 'Learn to cook five dishes',
    description: 'Build a small set of meals you can make on your own.',
    category: 'Personal Growth',
    steps: [
      'Pick five simple dishes you enjoy',
      'Stock the basic ingredients and spices',
      'Cook the first dish with a recipe',
      'Cook each new dish once a week',
      'Make one dish without looking at the recipe',
      'Cook a meal for someone you like',
    ],
  },
  {
    id: 'learn-language',
    title: 'Learn a new language',
    description: 'Practise a little each day until you can hold a simple conversation.',
    category: 'Learning',
    steps: [
      'Choose a language and write down why',
      'Learn 20 common everyday words',
      'Practise 10 minutes a day for two weeks',
      'Watch one show with subtitles in that language',
      'Hold a five-minute conversation',
    ],
  },
  {
    id: 'read-12-books',
    title: 'Read 12 books this year',
    description: 'One book a month, with a short note after each one.',
    category: 'Learning',
    steps: [
      'Choose the first three books',
      'Read 20 pages a day',
      'Finish the first book',
      'Write a one-line review after each book',
      'Reach six books by mid-year',
      'Pick the next batch of books',
    ],
  },
  {
    id: 'plan-trip',
    title: 'Plan a trip abroad',
    description: 'Turn a travel wish into a booked and packed trip.',
    category: 'Travel',
    steps: [
      'Pick a destination and rough month',
      'Check your passport is valid for the trip',
      'Set a budget for flights, stay, and food',
      'Book flights',
      'Book accommodation',
      'Make a simple day-by-day plan',
      'Check the weather and pack',
    ],
  },
];
