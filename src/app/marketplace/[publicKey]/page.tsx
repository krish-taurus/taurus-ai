/**
 * Public shareable AI Employee resume (Sprint 033).
 *
 * Unauthenticated — anyone with the link can view. The org is resolved from the
 * opaque public key only; nothing but the published snapshot is ever exposed
 * (DNA with companyContext blanked, performance summary, vault descriptions).
 * No dashboard chrome, no private tenant data, no hire controls.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { getPublicResumeByKey, listListingReviews } from "@/modules/marketplace/service";
import { ResumeView } from "@/components/marketplace/resume-view";
import { RatingSummary, RatingStars } from "@/components/marketplace/rating-stars";
import { buttonClasses } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { publicKey: string };
}): Promise<Metadata> {
  const listing = await getPublicResumeByKey(getStore(), params.publicKey);
  if (!listing) return { title: "Resume unavailable — Taurus AI" };
  return {
    title: `${listing.title} — AI Employee resume`,
    description: listing.headline ?? listing.roleTitle ?? undefined,
  };
}

export default async function PublicResumePage({ params }: { params: { publicKey: string } }) {
  const store = getStore();
  const listing = await getPublicResumeByKey(store, params.publicKey);
  if (!listing) notFound();

  // Reviews with reviewer org names — resolved server-side, snapshot-safe.
  const reviews = await listListingReviews(store, listing.id);
  const reviewRows = await Promise.all(
    reviews.map(async (r) => ({
      review: r,
      orgName: (await store.getOrganizationById(r.reviewerOrganizationId))?.name ?? "An organization",
    })),
  );

  return (
    <div className="min-h-screen bg-taurus-app">
      <header className="border-b border-taurus-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight text-taurus-text">Taurus AI</span>
          <Link href="/dashboard/marketplace" className={buttonClasses("secondary", "sm")}>
            Sign in to hire
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-taurus-faint">
          AI Employee resume
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-taurus-text">
          {listing.title}
        </h1>
        {listing.roleTitle ? (
          <p className="mt-0.5 text-sm text-taurus-sub">{listing.roleTitle}</p>
        ) : null}
        <div className="mt-3">
          <RatingSummary avg={listing.ratingAvg} count={listing.ratingCount} />
        </div>

        <div className="mt-6">
          <ResumeView listing={listing} />
        </div>

        <section className="mt-6 rounded-xl border border-taurus-line bg-taurus-elevated p-5">
          <p className="text-sm text-taurus-text">
            Want this AI Employee on your team? Sign in to Taurus AI to hire it — its DNA is cloned
            into your workspace. The owner&apos;s knowledge vault is never shared.
          </p>
          <div className="mt-3">
            <Link href="/dashboard/marketplace" className={buttonClasses("primary")}>
              Sign in to hire
            </Link>
          </div>
        </section>

        {/* Reviews */}
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-taurus-text">Reviews</h2>
          {reviewRows.length === 0 ? (
            <p className="text-sm text-taurus-faint">
              No reviews yet. Organizations that hire this AI Employee can leave one.
            </p>
          ) : (
            <ul className="space-y-3">
              {reviewRows.map(({ review, orgName }) => (
                <li
                  key={review.id}
                  className="rounded-lg border border-taurus-line bg-taurus-elevated p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-taurus-text">{orgName}</span>
                    <RatingStars value={review.rating} />
                  </div>
                  {review.comment ? (
                    <p className="mt-1.5 text-sm text-taurus-sub">{review.comment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
