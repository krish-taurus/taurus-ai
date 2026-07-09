import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { canReviewListing, getMyReview, listListingReviews } from "@/modules/marketplace/service";
import { availablePaymentProviders, platformFeeBps } from "@/modules/marketplace/payments";
import { formatMoney, isPricedListing } from "@/modules/marketplace/pricing";
import { ResumeView } from "@/components/marketplace/resume-view";
import {
  BuyButton,
  HireButton,
  UnpublishButton,
} from "@/components/marketplace/marketplace-buttons";
import { PriceForm } from "@/components/marketplace/price-form";
import { RatingSummary, RatingStars } from "@/components/marketplace/rating-stars";
import { ReviewForm } from "@/components/marketplace/review-form";
import { CopyButton } from "@/components/channels/copy-button";
import { getClientEnv } from "@/lib/env/env";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function MarketplaceListingPage({
  params,
  searchParams,
}: {
  params: { listingId: string };
  searchParams?: { requested?: string; reviewed?: string; purchased?: string; canceled?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.view")) redirect("/dashboard");

  const store = getStore();
  const listing = await store.getMarketplaceListing(params.listingId);
  // Only published listings are visible cross-org; owners can see their own.
  const own = listing?.organizationId === organization.id;
  if (!listing || (listing.status !== "published" && !own)) notFound();

  const canHire = hasPermission(membership.role, "employee.create");
  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const publicUrl = `${appUrl}/marketplace/${listing.publicKey}`;
  const priced = isPricedListing(listing);
  const priceLabel = priced ? formatMoney(listing.priceAmount as number, listing.priceCurrency as string) : null;
  const providers = availablePaymentProviders();

  // Reviews: list them (with reviewer org names) + the viewer's own review if any.
  const reviews = await listListingReviews(store, listing.id);
  const reviewRows = await Promise.all(
    reviews.map(async (r) => ({
      review: r,
      orgName: (await store.getOrganizationById(r.reviewerOrganizationId))?.name ?? "An organization",
    })),
  );
  const canReview =
    hasPermission(membership.role, "employee.create") &&
    (await canReviewListing(store, organization.id, listing));
  const myReview = canReview ? await getMyReview(store, listing.id, organization.id) : null;

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link href="/dashboard/marketplace" className="font-medium text-taurus-sub hover:text-taurus-text">
          ← Back to Marketplace
        </Link>
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <RatingSummary avg={listing.ratingAvg} count={listing.ratingCount} />
        {priceLabel ? (
          <Badge tone="soft">{priceLabel} to hire</Badge>
        ) : (
          <Badge tone="outline">Free to hire</Badge>
        )}
      </div>

      <PageHeader
        eyebrow="Employee resume"
        title={listing.title}
        description={listing.roleTitle ?? undefined}
        action={
          own ? (
            <div className="flex items-center gap-2">
              <Badge tone="outline">{listing.status}</Badge>
              {listing.status === "published" ? <UnpublishButton listingId={listing.id} /> : null}
            </div>
          ) : canHire ? (
            priced ? (
              <BuyButton listingId={listing.id} priceLabel={priceLabel as string} providers={providers} />
            ) : (
              <HireButton listingId={listing.id} />
            )
          ) : undefined
        }
      />

      {searchParams?.purchased ? (
        <Card className="mb-6 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-text">
          Payment received. A copy of this AI Employee (its DNA only) is being added to your AI
          Employees — the owner&apos;s knowledge vault is never shared.
        </Card>
      ) : null}
      {searchParams?.canceled ? (
        <Card className="mb-6 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-sub">
          Checkout was canceled — you have not been charged.
        </Card>
      ) : null}

      {searchParams?.requested ? (
        <Card className="mb-6 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-text">
          Your hire request was sent. The owner will review it — once approved, a copy of this
          AI Employee (its DNA only) appears in your AI Employees.
        </Card>
      ) : null}

      {own ? (
        <>
          <p className="mb-4 text-sm text-taurus-sub">
            This is your listing. It shows a snapshot taken when you published — re-publish from the
            employee to refresh its performance and DNA.
          </p>
          {listing.status === "published" ? (
            <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-taurus-text">Public shareable link</p>
                <p className="truncate text-sm text-taurus-sub">{publicUrl}</p>
                <p className="mt-1 text-xs text-taurus-faint">
                  Anyone with this link can view the resume — no sign-in required. It shows only the
                  published snapshot, never your knowledge vault.
                </p>
              </div>
              <CopyButton value={publicUrl} label="Copy link" />
            </Card>
          ) : null}

          <Card className="mb-6 p-4">
            <p className="mb-1 text-sm font-medium text-taurus-text">Hire price</p>
            <p className="mb-3 text-xs text-taurus-faint">
              Charge a one-time fee (buyers pay before the DNA is cloned) or keep it free
              (request → approve). You keep {100 - platformFeeBps() / 100}% after the platform fee.
              Only the DNA is ever sold — your knowledge vault is never shared.
            </p>
            <PriceForm
              listingId={listing.id}
              priceModel={listing.priceModel}
              priceMajor={priced ? String((listing.priceAmount as number) / 100) : ""}
              priceCurrency={listing.priceCurrency}
            />
          </Card>
        </>
      ) : null}

      <ResumeView listing={listing} />

      {!own && canHire ? (
        <Card className="mt-6 p-5">
          <p className="mb-3 text-sm text-taurus-sub">
            {priced
              ? `Buying clones this AI Employee's DNA into your workspace as a new AI Employee (${priceLabel}, one-time). `
              : "Hiring clones this AI Employee's DNA into your workspace as a new AI Employee. "}
            The owner&apos;s knowledge vault is never shared — you attach your own knowledge and
            model keys.
          </p>
          {priced ? (
            <BuyButton listingId={listing.id} priceLabel={priceLabel as string} providers={providers} />
          ) : (
            <HireButton listingId={listing.id} />
          )}
        </Card>
      ) : null}

      {/* Reviews */}
      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-taurus-text">Reviews</h2>

        {canReview ? (
          <Card className="mb-4 p-5">
            <p className="mb-3 text-sm text-taurus-sub">
              You&apos;ve hired this AI Employee — share how it performed for your team.
            </p>
            {searchParams?.reviewed ? (
              <p className="mb-3 text-sm text-taurus-text">Thanks — your review was saved.</p>
            ) : null}
            <ReviewForm
              listingId={listing.id}
              defaultRating={myReview?.rating}
              defaultComment={myReview?.comment ?? undefined}
            />
          </Card>
        ) : null}

        {reviewRows.length === 0 ? (
          <p className="text-sm text-taurus-faint">
            No reviews yet. Organizations that hire this AI Employee can leave one.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviewRows.map(({ review, orgName }) => (
              <li key={review.id} className="rounded-lg border border-taurus-line bg-taurus-elevated p-4">
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
    </div>
  );
}
