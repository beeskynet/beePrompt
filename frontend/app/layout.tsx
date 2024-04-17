import "styles/globals.css";
import Auth from "lib/auth";
import { RouteChangeListener } from "components/RouteChangeListener";

interface Props {
  children?: string
}

export default function RootLayout({ children, ...props }: Props) {
  return (
    <html lang="en">
      <RouteChangeListener />
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
      </head>
      <body>
        <Auth>{children}</Auth>
      </body>
    </html>
  );
}
