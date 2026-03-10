import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <PolarisAppProvider i18n={enTranslations}>
      <AppProvider embedded apiKey={apiKey}>
        <NavMenu>
          <a href="/app" rel="home">Dashboard</a>
          <a href="/app/saved">My Results</a>
          <a href="/app/keywords">Keywords</a>
          <a href="/app/campaigns">Campaigns</a>
          <a href="/app/settings">Settings</a>
        </NavMenu>
        <Outlet />
      </AppProvider>
    </PolarisAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export const shouldRevalidate = ({ currentUrl, nextUrl }) => {
  if (currentUrl.pathname !== nextUrl.pathname) return false;
  return true;
};
