This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Cleaner Assignment System

The calendar now supports assigning cleaners to checkout events. This feature has been enhanced with database persistence to ensure cleaner assignments are properly tracked and maintained.

### Key Features:
- Cleaners are loaded from the database instead of hardcoded values
- Assignments are saved to the `cleaner_assignments` table
- Each assignment tracks hours and maintains an active status
- When calendar events change, the system automatically updates assignment statuses
- Only active assignments count toward a cleaner's weekly hour limit

### Running the Migration

To add the required fields to your database, run the migration script:

```bash
# First ensure you have the service role key in your .env file
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Install dependencies if needed
npm install

# Run the migration script
node scripts/apply_migrations.js
```

This will add the `is_active` column to the `cleaner_assignments` table to track which assignments are currently valid.

### How It Works

1. When you assign a cleaner to a checkout event, it creates a record in the database
2. Each time the calendar loads, it verifies if assignments are still valid based on current calendar events
3. If a booking has changed or been deleted, the corresponding cleaner assignment is marked as inactive
4. Only active assignments count toward a cleaner's weekly hour limit
