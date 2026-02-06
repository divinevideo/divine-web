// ABOUTME: DMCA and copyright policy page
// ABOUTME: Explains fair use basis, content sources, and takedown procedures

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Archive, Scale, Mail } from 'lucide-react';
import { MarketingLayout } from '@/components/MarketingLayout';

export function DMCAPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Copyright & DMCA Policy</h1>

      <div className="space-y-8">
        {/* Fair Use */}
        <Card className="border-2 border-brand-green">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Fair Use Basis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine operates as a cultural preservation project recovering and hosting content that would otherwise
              be lost to history. Our use of archived Vine content is based on fair use principles under U.S. copyright
              law, specifically:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>
                <strong>Preservation and archival purposes:</strong> Preventing permanent loss of cultural artifacts
                after the original platform shutdown
              </li>
              <li>
                <strong>Transformative use:</strong> Presenting content in a new context focused on historical and
                cultural preservation
              </li>
              <li>
                <strong>Non-commercial nature:</strong> Divine is an open-source project not designed to generate
                revenue from user data
              </li>
              <li>
                <strong>No market harm:</strong> The original Vine platform no longer exists, and this content cannot
                be obtained elsewhere
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Content Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Content Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine recovers Vine videos from public archives maintained by preservation organizations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>
                <strong>ArchiveTeam:</strong> Volunteer archivists who preserved Vine content before the platform
                shut down in 2017 (
                <a href="https://wiki.archiveteam.org/index.php/Vine" rel="noopener noreferrer" className="text-primary hover:underline">
                  wiki.archiveteam.org/index.php/Vine
                </a>)
              </li>
              <li>
                <strong>Archive.org:</strong> The Internet Archive's public collection of historical web content
              </li>
            </ul>
            <p className="text-muted-foreground">
              We are committed to restoring proper creator attribution when possible and honoring the original
              creators who made Vine special.
            </p>
          </CardContent>
        </Card>

        {/* Copyright Claims */}
        <Card className="border-2 border-brand-yellow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Copyright Claims & Content Removal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              If you are the copyright owner of content hosted on Divine and wish to have it removed, we respect
              your rights and will process valid DMCA takedown requests.
            </p>

            <div className="bg-brand-dark-green p-4 rounded-lg border border-brand-green">
              <h3 className="font-semibold mb-3 text-brand-off-white">To File a DMCA Takedown Request:</h3>
              <p className="text-sm text-brand-light-green mb-3">
                Your notice must include the following information as required by the Digital Millennium Copyright Act:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-brand-light-green ml-4">
                <li>Your physical or electronic signature</li>
                <li>Identification of the copyrighted work claimed to have been infringed</li>
                <li>Identification of the material that is claimed to be infringing (including URLs or event IDs)</li>
                <li>Your contact information (address, telephone number, and email)</li>
                <li>
                  A statement that you have a good faith belief that the use of the material is not authorized by
                  the copyright owner, its agent, or the law
                </li>
                <li>
                  A statement that the information in the notification is accurate, and under penalty of perjury,
                  that you are authorized to act on behalf of the copyright owner
                </li>
                <li>
                  <strong>Proof of ownership:</strong> You must demonstrate that you are the original creator or
                  copyright holder of the content (e.g., links to your accounts on other platforms, original files,
                  creation dates, etc.)
                </li>
              </ol>
            </div>

            <div className="bg-brand-dark-green p-4 rounded-lg border border-brand-green">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-brand-off-white">
                <Mail className="h-4 w-4" />
                Send DMCA Notices To:
              </h3>
              <p className="text-sm text-brand-light-green">
                Email: <a href="mailto:contact@divine.video" className="text-brand-green hover:text-brand-light-green">contact@divine.video</a>
              </p>
              <p className="text-sm text-brand-light-green mt-2">
                We will review valid requests and respond within 10 business days.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Counter-Notice */}
        <Card>
          <CardHeader>
            <CardTitle>Counter-Notice Procedure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              If you believe content was removed in error or that you have the right to use the material, you may
              file a counter-notice containing:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
              <li>Your physical or electronic signature</li>
              <li>Identification of the material that was removed</li>
              <li>
                A statement under penalty of perjury that you have a good faith belief the material was removed
                by mistake or misidentification
              </li>
              <li>Your name, address, telephone number, and email</li>
              <li>
                A statement that you consent to the jurisdiction of the Federal District Court for your judicial
                district (or if outside the U.S., any district where Divine may be found)
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Repeat Infringers */}
        <Card>
          <CardHeader>
            <CardTitle>Repeat Infringer Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Divine will terminate accounts of users who are determined to be repeat copyright infringers in
              accordance with applicable law.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="border-2 border-brand-green">
          <CardHeader>
            <CardTitle>Questions?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              For questions about this policy or copyright issues not related to DMCA takedowns, please contact
              us at{" "}
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default DMCAPage;
