// ABOUTME: The working account-export tool behind the /exit portability guide
// ABOUTME: Signs the owner-export request with the current Divine session and returns a zip

import {
  Archive,
  ArrowClockwise,
  Broadcast,
  CheckCircle,
  Copy,
  DownloadSimple,
  Key,
  MapPin,
  WarningCircle,
} from "@phosphor-icons/react";
import { useNostrLogin } from "@nostrify/react/login";
import { useHead } from "@unhead/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { DestinationForm } from "@/components/exit/DestinationForm";
import { DiscoveryPointerForm } from "@/components/exit/DiscoveryPointerForm";
import { KeySafetyNotice } from "@/components/exit/KeySafetyNotice";
import { MediaProgressList } from "@/components/exit/MediaProgressList";
import { RelayDestinationForm } from "@/components/exit/RelayDestinationForm";
import { LoginArea } from "@/components/auth/LoginArea";
import { LocalNsecBanner } from "@/components/auth/LocalNsecBanner";
import { MarketingLayout } from "@/components/MarketingLayout";
import { SectionHero } from "@/components/static-pages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFunnelcakeBaseUrl } from "@/config/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useArchiveMediaExport } from "@/hooks/useArchiveMediaExport";
import { useDestinationMirror } from "@/hooks/useDestinationMirror";
import { useDestinationRepublish } from "@/hooks/useDestinationRepublish";
import { buildArchiveFiles, serializeArchiveFiles, type ArchiveFiles } from "@/lib/exit/archive";
import { oldestArchivedVideoDate } from "@/lib/exit/archiveAge";
import { exportOwnerEvents, OwnerExportError, type ExportProgress } from "@/lib/exit/ownerExportClient";
import { createZip } from "@/lib/exit/zip";
import { getLocalNsecLogin } from "@/lib/localNsecAccount";

type RunState = "idle" | "running" | "complete" | "failed";

function errorMessage(error: unknown): string {
  if (error instanceof OwnerExportError) {
    return error.message;
  }

  return "The export stopped before an archive could be created. Try again.";
}

function downloadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The archive could not be downloaded. Try creating it again.";
}

async function downloadArchive(files: ArchiveFiles): Promise<void> {
  if (typeof URL.createObjectURL !== "function") {
    throw new Error("This browser cannot create the archive download. Try another browser.");
  }

  const zip = await createZip(serializeArchiveFiles(files));
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
          "Download a portable archive of your Divine posts, video records, and media files.",
      },
    ],
  });

  const { user, signer, isResolvingJwt } = useCurrentUser();
  const { logins } = useNostrLogin();
  const localNsecLogin = user ? getLocalNsecLogin(logins, user.pubkey) : null;

  const [state, setState] = useState<RunState>("idle");
  const [progress, setProgress] = useState<ExportProgress>({
    pagesFetched: 0,
    eventsFetched: 0,
    retryCount: 0,
  });
  const [archiveFiles, setArchiveFiles] = useState<ArchiveFiles | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const activeExport = useRef<AbortController | null>(null);
  const currentPubkey = useRef(user?.pubkey);
  currentPubkey.current = user?.pubkey;
  const mediaExport = useArchiveMediaExport({ files: archiveFiles, signer });
  const destinationMirror = useDestinationMirror({ files: archiveFiles, signer });
  const destinationRepublish = useDestinationRepublish({
    files: archiveFiles,
    mirrorResults: destinationMirror.results,
    signer,
  });

  useEffect(() => {
    activeExport.current?.abort();
    activeExport.current = null;
    setState("idle");
    setFailure(null);
    setArchiveFiles(null);
    setProgress({ pagesFetched: 0, eventsFetched: 0, retryCount: 0 });

    return () => activeExport.current?.abort();
  }, [user?.pubkey]);

  const summary = useMemo(() => {
    if (!archiveFiles) {
      return null;
    }

    return {
      events: archiveFiles["manifest.json"].event_count,
      pages: archiveFiles["manifest.json"].page_count,
      media: archiveFiles["media.json"].length,
      failures: archiveFiles["manifest.json"].failures,
    };
  }, [archiveFiles]);
  const oldestVideoDate = useMemo(
    () => archiveFiles ? oldestArchivedVideoDate(archiveFiles["events.json"]) : null,
    [archiveFiles],
  );

  async function runExport() {
    if (!user?.pubkey || !signer) {
      return;
    }

    setState("running");
    setFailure(null);
    setArchiveFiles(null);
    setProgress({ pagesFetched: 0, eventsFetched: 0, retryCount: 0 });
    activeExport.current?.abort();
    const controller = new AbortController();
    const exportPubkey = user.pubkey;
    const exportEndpoint = getFunnelcakeBaseUrl();
    activeExport.current = controller;

    try {
      const result = await exportOwnerEvents({
        endpointBase: exportEndpoint,
        pubkey: exportPubkey,
        signer,
        signal: controller.signal,
        onProgress: setProgress,
      });

      if (controller.signal.aborted || currentPubkey.current !== exportPubkey) {
        return;
      }

      setArchiveFiles(
        buildArchiveFiles({
          events: result.events,
          pubkey: exportPubkey,
          sourceEndpoint: exportEndpoint,
          pageCount: result.pageCount,
          failures: result.failures,
        })
      );
      setState("complete");
    } catch (error) {
      if (controller.signal.aborted || currentPubkey.current !== exportPubkey) {
        return;
      }
      setFailure(errorMessage(error));
      setState("failed");
    } finally {
      if (activeExport.current === controller) {
        activeExport.current = null;
      }
    }
  }

  async function handleDownloadArchive() {
    if (!archiveFiles) {
      return;
    }

    try {
      await downloadArchive(archiveFiles);
    } catch (error) {
      setFailure(downloadErrorMessage(error));
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
                  onClick={() => void handleDownloadArchive()}
                  disabled={!archiveFiles}
                >
                  <DownloadSimple className="h-4 w-4" aria-hidden="true" />
                  Download archive (.zip)
                </Button>
                <Button
                  type="button"
                  variant="sticker"
                  onClick={() => void mediaExport.start()}
                  disabled={!archiveFiles || !mediaExport.supported || mediaExport.state === "running"}
                >
                  {mediaExport.state === "running" ? (
                    <ArrowClockwise className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <DownloadSimple className="h-4 w-4" aria-hidden="true" />
                  )}
                  {mediaExport.state === "running" ? "Saving media" : "Save media archive"}
                </Button>
              </div>

              {!mediaExport.supported && archiveFiles && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This browser can download the JSON archive, but it cannot safely assemble one large media archive. Use a browser that supports saving directly to a file for the media copy.
                </p>
              )}

              <MediaProgressList progress={mediaExport.progress} />

              {mediaExport.state === "complete" && (
                <p className="text-base font-semibold text-foreground" role="status">Your media archive is saved.</p>
              )}

              {mediaExport.state === "failed" && mediaExport.failure && (
                <p className="text-base text-destructive" role="alert">{mediaExport.failure}</p>
              )}

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
                <Card variant="brand" accent={summary.failures.length > 0 ? "yellow" : "green"}>
                  <CardContent className="pt-6 flex items-start gap-3">
                    {summary.failures.length > 0 ? (
                      <WarningCircle
                        weight="fill"
                        className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green"
                      />
                    ) : (
                      <CheckCircle
                        weight="fill"
                        className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green"
                      />
                    )}
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">
                        {summary.failures.length > 0
                          ? "This archive is incomplete."
                          : summary.events === 0
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
                      {summary.failures.map((failure) => (
                        <p
                          key={`${failure.code}-${failure.message}`}
                          className="text-base leading-relaxed text-muted-foreground"
                        >
                          {failure.message}
                        </p>
                      ))}
                      {summary.failures.length > 0 && (
                        <p className="text-base leading-relaxed text-muted-foreground">
                          You can download what was collected and run the export again;
                          starting over is safe and does not duplicate anything.
                        </p>
                      )}
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

        {archiveFiles && signer && (
          <section>
            <SectionHero
              eyebrow="Choose a destination"
              icon={<Copy weight="fill" className="h-7 w-7" />}
              title="Move your media"
              lead="Copy the original files to another Blossom server. Nothing is removed from Divine, and one refused file will not stop the rest."
            />
            <DestinationForm
              state={destinationMirror.state}
              progress={destinationMirror.progress}
              summary={destinationMirror.summary}
              failure={destinationMirror.failure}
              onStart={destinationMirror.start}
            />
          </section>
        )}

        {archiveFiles && signer && destinationMirror.state === "complete" && destinationMirror.results && (
          <section>
            <SectionHero
              eyebrow="Choose a relay"
              icon={<Broadcast weight="fill" className="h-7 w-7" />}
              title="Move your posts"
              lead="Publish your public posts to another relay. Private messages, temporary authentication events, and deletion requests stay where they are."
            />
            <RelayDestinationForm
              state={destinationRepublish.state}
              progress={destinationRepublish.progress}
              results={destinationRepublish.results}
              summary={destinationRepublish.summary}
              failure={destinationRepublish.failure}
              oldestVideoDate={oldestVideoDate}
              onStart={destinationRepublish.start}
            />
          </section>
        )}

        {archiveFiles
          && signer
          && destinationMirror.destination
          && destinationRepublish.destination
          && destinationRepublish.state === "complete"
          && destinationRepublish.summary
          && destinationRepublish.summary.published + destinationRepublish.summary.unchanged > 0 && (
          <section>
            <SectionHero
              eyebrow="Make the move discoverable"
              icon={<MapPin weight="fill" className="h-7 w-7" />}
              title="Publish your new home"
              lead="Publish pointers that name only your destination to Divine and public metadata relays, so compatible apps can find your relay and Blossom server."
            />
            <DiscoveryPointerForm
              files={archiveFiles}
              relayDestination={destinationRepublish.destination}
              blossomDestination={destinationMirror.destination}
              signer={signer}
            />
            <Card variant="brand" accent="violet" className="mt-5">
              <CardHeader>
                <CardTitle>Old copies stay where they are</CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-relaxed text-muted-foreground">
                Other relays may already hold copies of your posts. Those copies can
                still point at Divine-hosted media, so apps that use them may keep
                loading your videos from Divine. Moving cannot update or remove those
                copies.
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <SectionHero
            eyebrow="Your account keys"
            icon={<Key weight="fill" className="h-7 w-7" />}
            title="Where your key lives"
            lead="Your account is a key, not a username. Whether you can hold that key yourself depends on how you signed up."
          />

          {/* This card always renders. The backup controls below gate themselves for
              protected minors by rendering null (#182), so if the explanation lived
              inside that component this section would collapse to a bare heading for
              exactly the readers least able to fill in the gap themselves. */}
          <Card variant="brand" accent="blue">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              {localNsecLogin ? (
                <>
                  <p>
                    This account has its own key, stored in this browser rather than on a
                    Divine server. That key is what proves the account is yours, here and
                    anywhere else that speaks the same protocol.
                  </p>
                  <p>
                    Keep a copy of it somewhere safe. If it is lost, nobody can restore it
                    for you &mdash; not Divine, not anyone.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This account signs through a browser extension or another signer,
                    rather than a secret key stored directly by this page. This page
                    cannot reveal a key it does not hold.
                  </p>
                  <p>
                    What that means for moving: your public identity &mdash; the name other
                    apps know you by &mdash; is yours and does not change. The ability to
                    sign new events depends on whichever signer this account uses.
                  </p>
                  <p>
                    Creating an archive still requires that signer to approve the request.
                    Once downloaded, everything in the archive is already signed and stays
                    verifiable no matter what happens to how you sign in.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {localNsecLogin ? (
            <div className="mt-5">
              <LocalNsecBanner nsec={localNsecLogin.data.nsec} />
            </div>
          ) : null}

          <div className="mt-5">
            <KeySafetyNotice />
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}

export default ExitStartPage;
