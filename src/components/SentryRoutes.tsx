import { useState, type ComponentProps } from 'react';
import { Routes } from 'react-router-dom';
import { withSentryReactRouterV6Routing } from '@sentry/react';

export function SentryRoutes(props: ComponentProps<typeof Routes>) {
  const [InstrumentedRoutes] = useState(() => withSentryReactRouterV6Routing(Routes));
  return <InstrumentedRoutes {...props} />;
}
