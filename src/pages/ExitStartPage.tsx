// ABOUTME: The working account-export tool behind the /exit portability guide
// ABOUTME: Signs the owner-export request with the current Divine session and returns a zip

import {
  Archive,
  ArrowClockwise,
  CheckCircle,
  DownloadSimple,
  Key,
  WarningCircle,
} from "@phosphor-icons/react";
import { useNostrLogin } from "@nostrify/react/login";
import { useHead } from "@unhead/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { LocalNsecBanner } from "@/components/auth/LocalNsecBanner";
import { LoginArea } from "@/components/auth/LoginArea";
import { MarketingLayout } from "@/components/MarketingLayout";
import { SectionHero } from "@/components/static-pages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { buildArchiveFiles, serializeArchiveFiles, type ArchiveFiles } from "@/lib/exit/archive";
import { exportOwnerEvents, OwnerExportError, type ExportProgress } from "@/lib/exit/ownerExportClient";
import { createZip } from "@/lib/exit/zip";
import { getActiveLocalNsecLogin } from "@/lib/localNsecAccount";

type RunState = "idle" | "running" | "complete" | "failed";

const EXPORT_ENDPOINT = "https://api.divine.video";

function errorMessage(error: unknown): string {
  if (error instanceof OwnerExportError) {
    return error.message;
  }

  return "The export stopped before an archive could be created. Try again.";
}

function downloadArchive(files: ArchiveFiles): void {
  if (typeof URL.createObjectURL !== "function") {
    return;
  }

  const zip = createZip(serializeArchiveFiles(files));
  const url = URL.createObjectURL(zip);
  const link = document.createElement("a");

  link.href = url;
  link.download = `divine-export-${files["manifest.json"].pubkey}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExitStartPage() {
  useHead({
    title: "Export your Divine account",
    link: [{ rel: "canonical", href: "https://divine.video/exit/start" }],
    meta: [
      {
        name: "description",
        content:
          "Download a portable archive of your Divine posts, video records, and media references.",
      },
    ],
  });

  const { user, signer, isResolvingJwt } = useCurrentUser();
  const { logins } = useNostrLogin();
  const localNsecLogin = getActiveLocalNsecLogin(logins);

  const [state, setState] = useState<RunState>("idle");
  const [progress, setProgress] = useState<ExportProgress>({
    pagesFetched: 0,
    eventsFetched: 0,
    retryCount: 0,
  });
  const [archiveFiles, setArchiveFiles] = useState<ArchiveFiles | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!archiveFiles) {
      return null;
    }

    return {
      events: archiveFiles["manifest.json"].event_count,
      pages: archiveFiles["manifest.json"].page_count,
      media: archiveFiles["media.json"].length,
    };
  }, [archiveFiles]);

  async function runExport() {
    if (!user?.pubkey || !signer) {
      return;
    }

    setState("running");
    setFailure(null);
    setArchiveFiles(null);
    setProgress({ pagesFetched: 0, eventsFetched: 0, retryCount: 0 });

    try {
      const result = await exportOwnerEvents({
        endpointBase: EXPORT_ENDPOINT,
        pubkey: user.pubkey,
        signer,
        onProgress: setProgress,
      });

      setArchiveFiles(
        buildArchiveFiles({
          events: result.events,
          pubkey: user.pubkey,
          sourceEndpoint: EXPORT_ENDPOINT,
          pageCount: result.pageCount,
          failures: result.failures,
        })
      );
      setState("complete");
    } catch (error) {
      setFailure(errorMessage(error));
      setState("failed");
    }
  }

  return (
    <MarketingLayout>
      <section className="bg-brand-dark-green text-brand-off-white">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
            <Archive weight="fill" className="h-4 w-4" />
            <span>Account export</span>
          </div>
          <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-6xl leading-[1.05] text-brand-off-white mb-6">
            Take your Divine data with you
          </h1>
          <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
            This builds a downloadable archive of your posts, video records, and the
            media they point at. Nothing is deleted from Divine, and you can run it
            as many times as you like.
          </p>
          <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-4">
            For what moving means and what happens next, read the{" "}
            <Link
              to="/exit"
              className="font-semibold text-brand-green underline decoration-brand-green/60 underline-offset-4 hover:text-brand-light-green"
            >
              account portability guide
            </Link>
            .
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 md:py-16 max-w-4xl space-y-16">
        <section>
          <SectionHero
            eyebrow="Download your copy"
            icon={<Archive weight="fill" className="h-7 w-7" />}
            title="Build your archive"
            lead="The archive contains events.json (your signed posts exactly as Divine returned them), manifest.json (what was collected and anything that failed), and media.json (where your media lives and how to verify it)."
          />

          {!user && isResolvingJwt ? (
            <Card variant="brand" accent="green">
              <CardContent className="pt-6 flex items-center gap-3">
                <ArrowClockwise className="h-5 w-5 animate-spin text-brand-dark-green dark:text-brand-green" aria-hidden="true" />
                <p className="text-base leading-relaxed text-muted-foreground">
                  Checking your Divine session&hellip;
                </p>
              </CardContent>
            </Card>
          ) : !user ? (
            <Card variant="brand" accent="green">
              <CardHeader>
                <CardTitle>Sign in to export your account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-base leading-relaxed text-muted-foreground">
                  Divine only releases an account&apos;s export to that account. Signing in
                  proves the request is yours; nothing is sent anywhere else.
                </p>
                <LoginArea />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => void runExport()}
                  disabled={state === "running" || !signer}
                >
                  {state === "running" ? (
                    <ArrowClockwise className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Archive className="h-4 w-4" aria-hidden="true" />
                  )}
                  {state === "running" ? "Building your archive" : "Create my archive"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => archiveFiles && downloadArchive(archiveFiles)}
                  disabled={!archiveFiles}
                >
                  <DownloadSimple className="h-4 w-4" aria-hidden="true" />
                  Download archive (.zip)
                </Button>
              </div>

              {!signer && (
                <Card variant="brand" accent="pink">
                  <CardContent className="pt-6 flex items-start gap-3">
                    <WarningCircle
                      weight="fill"
                      className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green"
                    />
                    <p className="text-base leading-relaxed text-muted-foreground">
                      This session cannot sign the export request. Sign out and sign back
                      in, then try again.
                    </p>
                  </CardContent>
                </Card>
              )}

              {state !== "idle" && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-brand-dark-green/15 dark:border-brand-green/25 p-4"
                  aria-live="polite"
                >
                  <div>
                    <span className="font-display text-2xl font-extrabold text-brand-dark-green dark:text-brand-green">
                      {progress.pagesFetched}
                    </span>
                    <p className="text-sm text-muted-foreground">Pages read</p>
                  </div>
                  <div>
                    <span className="font-display text-2xl font-extrabold text-brand-dark-green dark:text-brand-green">
                      {progress.eventsFetched}
                    </span>
                    <p className="text-sm text-muted-foreground">Events found</p>
                  </div>
                  <div>
                    <span className="font-display text-2xl font-extrabold text-brand-dark-green dark:text-brand-green">
                      {progress.retryCount}
                    </span>
                    <p className="text-sm text-muted-foreground">Retries</p>
                  </div>
                </div>
              )}

              {state === "complete" && summary && (
                <Card variant="brand" accent="green">
                  <CardContent className="pt-6 flex items-start gap-3">
                    <CheckCircle
                      weight="fill"
                      className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green"
                    />
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">
                        {summary.events === 0
                          ? "Your archive is ready, and it is empty."
                          : "Your archive is ready."}
                      </p>
                      <p className="text-base leading-relaxed text-muted-foreground">
                        {summary.pages} page{summary.pages === 1 ? "" : "s"} read,{" "}
                        {summary.events} event{summary.events === 1 ? "" : "s"} and{" "}
                        {summary.media} media reference{summary.media === 1 ? "" : "s"}{" "}
                        collected from Divine. Other relays were not checked, so anything
                        you posted elsewhere is not in this file.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {state === "failed" && failure && (
                <Card variant="brand" accent="pink">
                  <CardContent className="pt-6 flex items-start gap-3" role="alert">
                    <WarningCircle
                      weight="fill"
                      className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green"
                    />
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">The export stopped.</p>
                      <p className="text-base leading-relaxed text-muted-foreground">{failure}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>

        <section>
          <SectionHero
            eyebrow="Your account keys"
            icon={<Key weight="fill" className="h-7 w-7" />}
            title="Where your key lives"
            lead="Your account is a key, not a username. Whether you can hold that key yourself depends on how you signed up."
          />

          {localNsecLogin ? (
            <LocalNsecBanner nsec={localNsecLogin.data.nsec} />
          ) : (
            <Card variant="brand" accent="blue">
              <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
                <p>
                  Divine&apos;s signer holds the key for this account, so there is no secret
                  key for this page to hand you. You can still export everything below, and
                  your account keeps working in other apps that can ask this signer to sign
                  for you.
                </p>
                <p>
                  Accounts created with their own key can back it up here instead. If you
                  need a key you hold yourself, that is a change to how you sign in, not
                  something this export can do.
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </MarketingLayout>
  );
}

export default ExitStartPage;
