# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Package Manager
This project uses **pnpm** as the package manager. Always use pnpm commands instead of npm.

### Common Development Commands
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

### Running the Development Server
- Development server runs on `http://localhost:3000`
- Use `pnpm dev` to start the development server with hot reloading

## Browser Automation

- Prefer the Codex native Chrome/browser plugin for authenticated websites, account/admin workflows, uploads, payments, passkeys, 2FA, and user-assisted login flows.
- Use `/browse` when the native Chrome/browser plugin is unavailable, fails on the target site, or when the task needs fast deterministic headless QA, screenshots, responsive checks, console/network inspection, or repeatable public-page verification.
- For sensitive admin surfaces such as KDP, App Store Connect, DocuSign, banking/tax, or cloud billing, hand off login/2FA to the user in the native browser when possible, then continue automation from the authenticated session.
- When browser state matters, report which browser surface was used and whether the user-authenticated session was actually attached before claiming the task is complete.

## Project Architecture

### Framework & Tech Stack
- **Next.js 15.2.4** with App Router (not Pages Router)
- **TypeScript** for type safety
- **Tailwind CSS** for styling with custom design system
- **Shadcn/ui** components library built on Radix UI
- **React 19** with modern React patterns

### Key Directory Structure
```
app/                    # Next.js App Router - main application routes
├── books/[id]/        # Dynamic route for individual book pages
├── column/[id]/       # Dynamic route for blog/column posts
├── globals.css        # Global styles and CSS variables
├── layout.tsx         # Root layout with SEO metadata
└── page.tsx           # Homepage

components/            # Reusable React components
├── ui/               # Shadcn/ui components (auto-generated, avoid editing)
├── blog-section.tsx  # Blog posts display component
├── books-section.tsx # Books catalog component
├── hero-section.tsx  # Homepage hero section
└── ...               # Other custom components

lib/                   # Utility functions and data
├── books-data.ts     # Static book catalog data
├── blog-data.ts      # Blog posts metadata
├── markdown.ts       # Markdown processing utilities
└── utils.ts          # General utility functions

content/blog/         # Markdown blog posts (.md files)
public/              # Static assets
```

### Data Management
- **Static Data**: Books and blog metadata stored in `lib/books-data.ts` and `lib/blog-data.ts`
- **Content**: Blog posts written in Markdown format in `content/blog/`
- **Images**: Organized in `public/` with subfolders for different content types

### Styling System
- **Design System**: Custom color palette defined in `tailwind.config.ts`
  - Primary colors: `#1a1a1a` (dark), `#ff6b35` (accent-orange)
  - Typography: Inter font family for headings, system fonts for body
- **Theme**: Dark theme with orange accents throughout
- **Responsive**: Mobile-first approach with Tailwind breakpoints

### Content Processing
- **Markdown**: Uses `gray-matter` for frontmatter parsing and `remark` for HTML conversion
- **Blog System**: Dynamic routing with markdown content processing in `lib/markdown.ts`
- **SEO**: Comprehensive meta tags, OpenGraph, and JSON-LD structured data in root layout

### Component Architecture
- Uses Shadcn/ui pattern with `components/ui/` for base components
- Custom components extend ui components with business logic
- TypeScript interfaces defined alongside data (see `lib/books-data.ts` for Book interface)

## Important Configuration Notes

### Next.js Configuration
- **Build Ignores**: ESLint and TypeScript errors ignored during builds (`next.config.mjs`)
- **Images**: Unoptimized images setting enabled for static hosting compatibility
- **TypeScript**: Uses `@/*` path mapping for imports

### Development Practices
- **Imports**: Use `@/` prefix for all internal imports (configured in `tsconfig.json`)
- **Components**: Follow existing patterns in `components/` directory
- **Data Updates**: Book and blog data changes require updating respective files in `lib/`
- **Styling**: Use Tailwind classes, leverage existing custom colors from config

### Content Management
- **Adding Blog Posts**: Create `.md` files in `content/blog/` with proper frontmatter
- **Adding Books**: Update `BOOKS_DATA` array in `lib/books-data.ts`
- **Images**: Place in appropriate `public/` subdirectories

### SEO & Metadata
- **Metadata**: Configured in `app/layout.tsx` with comprehensive SEO setup
- **Structured Data**: JSON-LD schema for organization and books
- **Social**: OpenGraph and Twitter card metadata configured

## Skills policy

Nanuda company site — Next.js 15 App Router + React 19 + Tailwind + shadcn. Content: books + blog MD. Package manager: **pnpm**.

### Prefer
| Area | Use |
|------|-----|
| App | Next/React, shadcn `components/ui` (don't hand-edit generated UI primitives casually) |
| Content | `content/blog/*.md`, `lib/books-data.ts` — extend data, don't invent CMS |
| SEO | Existing metadata/JSON-LD in `app/layout.tsx` — extend |
| Browser | Codex native Chrome for authenticated admin; `/browse` or Playwright for public QA |
| Styling | Tailwind + existing design tokens |

### Reach for when needed
- critique / design polish
- ai-sdk — only if a feature already uses LLM
- analytics — if adding tracking
- seo-audit — ranking work

### Verify
`pnpm dev/build/lint` · visual check of touched routes · no new backend without ask
