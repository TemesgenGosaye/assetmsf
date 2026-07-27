import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteLayout } from "@/components/site/SiteLayout";

const BaseUrl = "https://samsproject.in";
const HeroDescription =
  "SAMS centralizes the entire asset lifecycle with QR-enabled tracking, collaborative workflows, and audit-ready reporting in a responsive, open-source platform.";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SAMS — Smart Asset Management System",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: BaseUrl,
  description: HeroDescription,
  image: `${BaseUrl}/sams_logo.png`,
  offers: {
    "@type": "Offer",
    price: "0.00",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  author: {
    "@type": "Person",
    name: "Temesgen",
    email: "mailto:tamizowarrior7@gmail.com",
  },
  publisher: {
    "@type": "Organization",
    name: "SAMS Project",
    url: BaseUrl,
  },
};

export default function Website() {
  return (
    <SiteLayout>
      <Helmet>
        <title>SAMS — Smart Asset Management System</title>
        <meta name="description" content={HeroDescription} />
        <meta
          name="keywords"
          content="asset management software, qr code asset tracking, supabase asset system, equipment tracking, facilities management, audit-ready reporting, open source asset platform"
        />
        <meta name="author" content="Temesgen" />
        <link rel="canonical" href={BaseUrl} />
        <meta property="og:title" content="SAMS — Smart Asset Management System" />
        <meta property="og:description" content={HeroDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={BaseUrl} />
        <meta property="og:image" content={`${BaseUrl}/sams_logo.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SAMS — Smart Asset Management System" />
        <meta name="twitter:description" content={HeroDescription} />
        <meta name="twitter:image" content={`${BaseUrl}/sams_logo.png`} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="flex flex-col gap-24 pb-24">
        {/* Hero Section */}
        <section id="overview" className="pt-20 md:pt-32 pb-16">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-8">
              <div className="space-y-4 max-w-3xl">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                  Enterprise Asset Management <br className="hidden sm:inline" />
                  <span className="text-primary">Simplified.</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl leading-relaxed">
                  SAMS provides a unified platform to track assets, manage audits, and ensure compliance across your entire organization. 
                  Move beyond spreadsheets to a system designed for accuracy and accountability.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
                <Link 
                  to="/login" 
                  className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  Access Platform
                </Link>
                <a 
                  href="#features" 
                  className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features - Typography Focused */}
        <section id="features" className="bg-muted/30 py-24">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Asset Lifecycle Tracking</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Complete visibility from procurement to disposal. Track location, custody, and condition changes with a comprehensive audit trail for every item in your inventory.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Digital Audits & Verification</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Streamline physical verification with mobile-friendly tools. Assign audits to departments, capture evidence via camera, and reconcile discrepancies in real-time.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Compliance & Reporting</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate accurate depreciation schedules and compliance reports. Ensure your asset register matches financial records with automated depreciation calculations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Modules Section */}
        <section id="modules" className="container px-4 md:px-6">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">System Modules</h2>
            <p className="text-muted-foreground max-w-2xl">
              A modular architecture designed to handle specific operational needs while maintaining a unified data core.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Asset Registry</h4>
              <p className="text-sm text-muted-foreground">
                Centralized database for IT and non-IT assets with QR code generation, custody tracking, and bulk management capabilities.
              </p>
            </div>
            
            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Property Management</h4>
              <p className="text-sm text-muted-foreground">
                Manage physical locations, branches, and office spaces to organize assets geographically and monitor space allocation.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Employee Directory</h4>
              <p className="text-sm text-muted-foreground">
                Track staff profiles, job positions, department assignments, and asset custody history across the organization.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Residential Hub</h4>
              <p className="text-sm text-muted-foreground">
                Comprehensive housing and property allocation management across Permanent, Seasonal, and Guest residential categories.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Housing Application Engine</h4>
              <p className="text-sm text-muted-foreground">
                End-to-end application submission, custom scoring engine, queue reviews, and real-time status tracking for housing requests.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Approvals Workflow</h4>
              <p className="text-sm text-muted-foreground">
                Multi-tier authorization system for asset transfers, maintenance requests, and administrative operations.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">QR Codes & Mobile Scanning</h4>
              <p className="text-sm text-muted-foreground">
                Automated QR code label generation, printable tags, and camera-based mobile scanning for instant asset verification.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Audit Center</h4>
              <p className="text-sm text-muted-foreground">
                Plan and execute physical verification drives, assign department audits, capture photo evidence, and reconcile discrepancies.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Help Desk & Ticketing</h4>
              <p className="text-sm text-muted-foreground">
                Internal support ticketing system for asset repairs, service requests, SLA tracking, and maintenance scheduling.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Reports & Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Real-time dashboard insights, asset valuation schedules, category distributions, and exportable audit trail reports.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">User Access Control</h4>
              <p className="text-sm text-muted-foreground">
                Role-based authorization (Admin, Manager, User, Requester, Applicant) with granular department-level permissions.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">System Settings & Customization</h4>
              <p className="text-sm text-muted-foreground">
                Visual theme configurations, UI density modes, notification controls, and system-wide operational parameters.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">License & Governance</h4>
              <p className="text-sm text-muted-foreground">
                Enterprise software licensing compliance management, feature access oversight, and system module governance.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">System Status & Health</h4>
              <p className="text-sm text-muted-foreground">
                Real-time service health monitoring, database connectivity diagnostics, and operational status tracking.
              </p>
            </div>
          </div>
        </section>

        {/* Quality & Support Section (Restored Data) */}
        <section id="support" className="container px-4 md:px-6">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-bold mb-4">Built for Reliability</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">Testing:</span> Component-level tests roll out alongside critical modules.
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">Accessibility:</span> Keyboard-friendly experiences with ARIA defaults baked in.
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">Observability:</span> User-facing events surface in toasts and audit trails.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Support & Governance</h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  Email <a href="mailto:tamizowarrior7@gmail.com" className="text-primary hover:underline">tamizowarrior7@gmail.com</a> for guided walkthroughs or implementation planning.
                </p>
                <p>
                  Report bugs or request enhancements via our <a href="https://github.com/TemesgenGosaye/assetmsf" className="text-primary hover:underline">GitHub issues</a>.
                </p>
                <p>The project ships under the MIT License with a community Code of Conduct.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
