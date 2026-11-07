import type { Profile } from '../../src/profile/schema.js';

/** A small, valid profile. Tests clone it and break one thing at a time. */
export function validProfile(): Profile {
  return {
    summary: {
      name: 'Test Person',
      fictional: true,
      disclaimer: 'Test Person is a fictional person.',
      title: 'Backend Engineer',
      seniority: 'Senior',
      yearsOfExperience: 6,
      headline: 'Builds backend services.',
      domains: [{ name: 'Travel', description: 'Booking flows.' }],
      leadership: ['Mentored one engineer.'],
      education: [
        {
          degree: 'BSc',
          field: 'Computer Science',
          institution: 'Test University',
          graduationYear: 2018,
        },
      ],
    },
    skills: [
      { name: 'TypeScript', category: 'language', years: 6, level: 'expert', aliases: ['TS'] },
      { name: 'PostgreSQL', category: 'database', years: 4, aliases: ['Postgres'] },
    ],
    projects: [
      {
        id: 'booking-api',
        name: 'Booking API',
        employer: 'Test Travel',
        domain: 'Travel',
        role: 'Backend Engineer',
        period: { start: '2020-01', end: '2021-06' },
        summary: 'A booking API.',
        tech: ['TypeScript', 'Postgres'],
        outcomes: ['Fewer errors.'],
      },
    ],
    experience: [
      {
        company: 'Test Travel',
        title: 'Backend Engineer',
        domain: 'Travel',
        period: { start: '2019-01', end: null },
        highlights: ['Built the booking API.'],
        tech: ['typescript'],
      },
    ],
  };
}
