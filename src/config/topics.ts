export const topicStatement =
  'Ich teile mein Wissen in Videos zu allen Themen, insbesondere Gesellschaft, Wirtschaft, Medien und Politik.';

export const topics = [
  {
    slug: 'gesellschaft',
    title: 'Gesellschaft',
    match: ['gesellschaft'],
  },
  {
    slug: 'wirtschaft',
    title: 'Wirtschaft',
    match: ['wirtschaft'],
  },
  {
    slug: 'medien',
    title: 'Medien',
    match: ['medien'],
  },
  {
    slug: 'politik',
    title: 'Politik',
    match: ['politik'],
  },
] as const;

export type Topic = (typeof topics)[number];
