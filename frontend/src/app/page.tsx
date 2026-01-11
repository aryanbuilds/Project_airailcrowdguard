import { ArrowRight, ShieldAlert, BadgeInfo, FileUp } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              <ShieldAlert className="h-4 w-4" />
              <span>Safety First Monitoring</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
              AI-Powered Railway Track Anomaly Detection
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload photos or short videos of railway tracks to detect defects and suspected tampering in real time. Help keep our railways safe with AI-driven insights.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/upload"
                className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
              >
                <FileUp className="h-5 w-5" />
                Report an Issue
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-all"
              >
                Admin Dashboard
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="mb-4 rounded-lg bg-blue-50 p-3 text-blue-600">
                <FileUp className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Mobile First Upload</h3>
              <p className="mt-2 text-slate-600">
                Report issues directly from your phone. Capture photos or short video clips of suspicious track areas.
              </p>
            </div>
            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="mb-4 rounded-lg bg-blue-50 p-3 text-blue-600">
                <BadgeInfo className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Real-Time Analysis</h3>
              <p className="mt-2 text-slate-600">
                Our two-stage YOLOv8 pipeline analyzes every upload instantly to identify defects and assess severity.
              </p>
            </div>
            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="mb-4 rounded-lg bg-blue-50 p-3 text-blue-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Tampering Detection</h3>
              <p className="mt-2 text-slate-600">
                Detect missing components and signs of unauthorized work on critical railway infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
