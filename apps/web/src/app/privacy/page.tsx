"use client";

export default function PrivacyPolicy() {
  return (
    <main className="container-mobile min-h-dvh py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mb-6 text-sm text-neutral-400">Last updated: February 15, 2026</p>

        <div className="space-y-8 text-neutral-300">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">1. Introduction</h2>
            <p>
              Welcome to Lovecoin (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy 
              and personal information. This Privacy Policy explains how we collect, use, disclose, and 
              safeguard your information when you use our web application and mobile application 
              (collectively, the &quot;Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">2. Information We Collect</h2>
            <h3 className="mb-2 text-lg font-medium text-white">2.1 Information You Provide</h3>
            <ul className="mb-4 list-disc space-y-2 pl-6">
              <li>Wallet address (Solana public key) when you connect your wallet</li>
              <li>Profile information you choose to provide (username, bio, profile picture)</li>
              <li>Messages and content you send through the platform</li>
              <li>Transaction history related to verification payments</li>
            </ul>
            
            <h3 className="mb-2 text-lg font-medium text-white">2.2 Automatically Collected Information</h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>Device information (browser type, operating system)</li>
              <li>Usage data (pages visited, features used)</li>
              <li>IP address and approximate location</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">3. How We Use Your Information</h2>
            <p className="mb-3">We use the collected information to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Provide and maintain our Service</li>
              <li>Verify your account through blockchain transactions</li>
              <li>Enable communication between users</li>
              <li>Improve and personalize your experience</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">4. Blockchain Data</h2>
            <p>
              Please note that blockchain transactions are publicly visible. When you connect your 
              Solana wallet and make transactions (such as verification payments), this information 
              is recorded on the public blockchain and cannot be deleted or modified. Your wallet 
              address and transaction history are publicly accessible on the Solana blockchain.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">5. Data Sharing</h2>
            <p className="mb-3">We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Other users (profile information you choose to make public)</li>
              <li>Service providers who assist in operating our platform</li>
              <li>Legal authorities when required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal 
              information. However, no method of transmission over the internet or electronic storage 
              is 100% secure. We cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Disconnect your wallet at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">8. Children&apos;s Privacy</h2>
            <p>
              Our Service is not intended for users under the age of 18. We do not knowingly collect 
              personal information from children. If you are a parent or guardian and believe your 
              child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes 
              by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:{" "}
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
