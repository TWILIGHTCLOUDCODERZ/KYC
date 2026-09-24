import Header from './Header';
import TopNav from './TopNav';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppShell({ children, title, subtitle }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-ntt-lightgray">
      <Header title={title} subtitle={subtitle} />
      <TopNav />
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="animate-fade-in p-4 sm:p-6 w-full">
          {children}
        </div>
      </main>
      <footer className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
        <p className="text-xs text-gray-400">
          NTT DATA Bank &copy; {new Date().getFullYear()} — Secure KYC Platform v1.0
        </p>
        <p className="text-xs text-gray-400">
          ISO 27001 Certified &nbsp;|&nbsp; GDPR Compliant &nbsp;|&nbsp; PCI-DSS Level 1
        </p>
      </footer>
    </div>
  );
}
