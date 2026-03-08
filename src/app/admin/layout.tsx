import {
  ClerkProvider,
  Show,
  UserButton,
  SignUpButton,
  SignInButton,
  RedirectToSignIn,
} from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ theme: dark }}>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
      <Show when="signed-in">
        <div className="fixed top-3 right-3 z-50">
          <UserButton />
        </div>
        <div className="dark relative">{children}</div>
      </Show>
    </ClerkProvider>
  );
}
