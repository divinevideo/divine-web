import { makeFetchTransport } from '@sentry/react';
import type { DynamicSamplingContext, Envelope, EnvelopeItem, Event, SpanJSON } from '@sentry/core';

import { getPerformanceRoute } from '@/lib/performanceRoutes';

const measurementNames = ['cls', 'fcp', 'fid', 'fp', 'inp', 'lcp', 'ttfb', 'ttfb.requestTime'];
const measurementUnits = new Set(['', 'none', 'millisecond']);
const outcomes = new Set(['ready', 'empty', 'error', 'timeout', 'cancelled']);
const timingAttributes = ['http.response.status_code', 'http.status_code', 'sentry.exclusive_time', 'ui.item_count',
  'http.response_content_length', 'http.decoded_response_content_length', 'http.encoded_response_content_length'];

function routeName(value: unknown): string {
  if (value === 'user_list_dialog') return value;
  if (typeof value !== 'string') return '/:unmatched';
  try {
    return getPerformanceRoute(value);
  } catch {
    return '/:unmatched';
  }
}

function timingMeasurements(measurements: Event['measurements']): Event['measurements'] {
  if (!measurements) return undefined;
  return Object.fromEntries(measurementNames.flatMap(name => {
    const measurement = measurements[name];
    return measurement && Number.isFinite(measurement.value)
      && typeof measurement.unit === 'string' && measurementUnits.has(measurement.unit)
      ? [[name, { value: measurement.value, unit: measurement.unit }]]
      : [];
  }));
}

function timingData(data: SpanJSON['data'] | undefined, op: string | undefined): SpanJSON['data'] {
  if (!data) return {};
  const result: SpanJSON['data'] = { 'sentry.op': op };
  for (const key of timingAttributes) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  for (const key of ['content.outcome', 'playback.outcome']) {
    const value = data[key];
    if (typeof value === 'string' && outcomes.has(value)) result[key] = value;
  }
  const navigation = data['navigation.type'];
  if (navigation === 'pageload' || navigation === 'navigation') result['navigation.type'] = navigation;
  if (typeof data['route.name'] === 'string') result['route.name'] = routeName(data['route.name']);
  if (typeof data.transaction === 'string') result.transaction = routeName(data.transaction);
  return result;
}

function timingSpan(span: SpanJSON): SpanJSON {
  const { op, origin, span_id, parent_span_id, trace_id, segment_id, is_segment,
    start_timestamp, timestamp, status, exclusive_time } = span;
  return {
    op, origin, span_id, parent_span_id, trace_id, segment_id, is_segment,
    start_timestamp, timestamp, status, exclusive_time,
    description: op,
    data: timingData(span.data, op),
    measurements: timingMeasurements(span.measurements),
  };
}

function timingTransaction(event: Event): Event {
  const { event_id, type, platform, release, environment, start_timestamp, timestamp, sdk, transaction_info } = event;
  const trace = event.contexts?.trace;
  return {
    event_id, type, platform, release, environment, start_timestamp, timestamp, sdk, transaction_info,
    transaction: routeName(event.transaction),
    request: { headers: { 'User-Agent': navigator.userAgent } },
    contexts: trace && {
      trace: {
        op: trace.op, origin: trace.origin, status: trace.status, trace_id: trace.trace_id,
        span_id: trace.span_id, parent_span_id: trace.parent_span_id, data: timingData(trace.data, trace.op),
      },
    },
    measurements: timingMeasurements(event.measurements),
    spans: event.spans?.map(timingSpan),
  };
}

function timingEnvelope(envelope: Envelope, sendPerformance: boolean): Envelope | null {
  const headers = envelope[0];
  const items: readonly EnvelopeItem[] = envelope[1];
  if (!items.some(([item]) => item.type === 'transaction' || item.type === 'span')) return envelope;
  if (!sendPerformance) return null;

  const trace = headers.trace as Partial<DynamicSamplingContext> | undefined;
  const timings = items.flatMap<EnvelopeItem>(([item, payload]) => {
    if (item.type === 'transaction') return [[{ type: 'transaction' }, timingTransaction(payload as Event)]];
    if (item.type !== 'span' || item.content_type) return [];
    const span = timingSpan(payload as SpanJSON);
    span.data.release = trace?.release;
    span.data.environment = trace?.environment;
    span.data['user_agent.original'] = navigator.userAgent;
    return [[{ type: 'span' }, span]];
  });
  if (!timings.length) return null;

  return [{
    event_id: headers.event_id, sent_at: headers.sent_at, sdk: headers.sdk, dsn: headers.dsn,
    trace: trace && {
      trace_id: trace.trace_id, public_key: trace.public_key, release: trace.release, environment: trace.environment,
      sample_rate: trace.sample_rate, sample_rand: trace.sample_rand, sampled: trace.sampled,
      transaction: typeof trace.transaction === 'string' ? routeName(trace.transaction) : undefined,
    },
  }, timings] as Envelope;
}

export function makeSentryPerformanceTransport(options: Parameters<typeof makeFetchTransport>[0], sendPerformance: boolean) {
  const transport = makeFetchTransport({
    ...options,
    fetchOptions: { ...options.fetchOptions, referrerPolicy: 'no-referrer' },
  });
  return {
    ...transport,
    async send(envelope: Envelope) {
      const sanitized = timingEnvelope(envelope, sendPerformance);
      return sanitized ? transport.send(sanitized) : {};
    },
  };
}
