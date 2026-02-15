"use client";

export default function TermsOfService() {
  return (
    <main className="container-mobile min-h-dvh py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold text-white">Terms of Service</h1>
        <p className="mb-6 text-sm text-neutral-400">Last updated: February 15, 2026</p>

        <div className="space-y-8 text-neutral-300">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Lovecoin (&quot;Service&quot;), you agree to be bound by these Terms of 
              Service. If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to use this Service. By using Lovecoin, you represent 
              and warrant that you are at least 18 years of age and have the legal capacity to enter 
              into these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">3. Account and Wallet</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>You are responsible for maintaining the security of your Solana wallet</li>
              <li>You are responsible for all activities that occur under your wallet address</li>
              <li>We are not responsible for any loss of funds due to wallet compromise</li>
              <li>Account verification requires a small SOL payment which is non-refundable</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">4. User Conduct</h2>
            <p className="mb-3">You agree NOT to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Use the Service for any illegal purpose</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Post false, misleading, or fraudulent content</li>
              <li>Impersonate any person or entity</li>
              <li>Send spam or unsolicited messages</li>
              <li>Attempt to hack, exploit, or disrupt the Service</li>
              <li>Use bots or automated systems without permission</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">5. Content</h2>
            <p>
              You retain ownership of content you post. By posting content, you grant us a non-exclusive, 
              worldwide, royalty-free license to use, display, and distribute your content in connection 
              with the Service. You are solely responsible for the content you post.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">6. Blockchain Transactions</h2>
            <p>
              All blockchain transactions are final and irreversible. We are not responsible for any 
              failed, incorrect, or fraudulent transactions. You understand and accept the risks 
              associated with blockchain technology and cryptocurrency.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">7. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND. 
              WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR 
              A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOVECOIN SHALL NOT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, 
              DATA, OR CRYPTOCURRENCY.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any time, 
              for any reason, without notice. You may stop using the Service at any time by 
              disconnecting your wallet.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">10. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. Continued use of the Service after changes 
              constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">11. Contact</h2>
            <p>
              For questions about these Terms, contact us at:{" "}
              <a href="mailto:support@lovecoin.fun" className="text-brand-400 hover:text-brand-300">
                support@lovecoin.fun
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-neutral-800 pt-6">
          <a href="/" className="text-brand-400 hover:text-brand-300">
            ← Back to Home
          </a>
        </div>
      </div>
    </main>
  );
}
