import { AuthProvider } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
