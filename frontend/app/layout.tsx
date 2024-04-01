import "styles/globals.css";
import Auth from "lib/auth";

export default function RootLayout({ children }: any) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
      </head>
      <body>
        <Auth>{children}</Auth>
      </body>
    </html>
  );
}
