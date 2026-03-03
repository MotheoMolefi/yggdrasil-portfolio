export interface Project {
  id: string
  title: string
  description: string
  stack: string[]
  url?: string
  github?: string
  position: [number, number, number]  // world-space coords (branch tip placement)
  color: string                       // orb accent color (hex)
}

export const projects: Project[] = [
  {
    id: 'project-1',
    title: 'The Nazarite',
    description: 'A 2D top-down action game built with LÖVE (Love2D) and Lua, inspired by the biblical story of Samson. Final project for Harvard\'s CS50x featuring wave-based combat with 3 difficulty tiers, enemy AI with line-of-sight detection and raycast pathfinding, physics-based collision, animation state machines, and a health system with collectible drops.',
    stack: ['Lua', 'LÖVE (Love2D)', 'Windfield (Box2D)'],
    url: 'https://youtu.be/uiW7kD4YMaQ',
    github: 'https://github.com/MotheoMolefi/the-nazarite',
    position: [600, 1800, 200],
    color: '#00ffff',
  },
  {
    id: 'project-3',
    title: 'TicTacToe (Authentication)',
    description: 'A full-stack game platform built to learn secure auth flows. Features email OTP verification, session management with middleware, PostgreSQL integration via Supabase, and a modern UI with animations and dark mode.',
    stack: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS', 'PostgreSQL', 'Supabase'],
    github: 'https://github.com/MotheoMolefi/tictactoe',
    position: [400, 2600, -400],
    color: '#66ff66',
  },
  {
    id: 'project-2',
    title: 'Mashonisa',
    description: 'A full-stack micro-lending platform built to digitise and formalise short-term personal lending in South Africa. Features a guided 4-step loan application with document upload, an affordability engine that calculates disposable income vs total repayment, tier-based borrowing limits (R700–R3,000) with automatic progression, and dual portals — a borrower dashboard for tracking applications and repayments, and an admin portal for reviewing, approving, disbursing, and auditing loans. Built with Row Level Security, role-based access control via Supabase RPC, audit logging, and designed with South African NCR compliance in mind.',
    stack: ['Next.js 15', 'TypeScript', 'React', 'Supabase (PostgreSQL)', 'Tailwind CSS', 'shadcn/ui', 'Zod'],
    position: [-500, 2200, -300],
    color: '#ff66ff',
  },
]
