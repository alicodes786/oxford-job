import { redirect } from 'next/navigation';

/** Legacy route; main listings live at /dashboard/listings */
export default function AllListingsRedirectPage() {
  redirect('/dashboard/listings');
}
