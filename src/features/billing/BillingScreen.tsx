import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  Gauge,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react-native";
import {
  cancelTenantSubscription,
  changeTenantSubscriptionPlan,
  confirmBillingCheckout,
  createBillingCheckout,
  createBillingPortal,
  getBillingAccountStatus,
  getCurrentTenantSubscription,
  getTenantEntitlements,
  getTenantUsageSummary,
  listTenantBillingEvents,
  listBillingPlans,
  listTenantInvoices,
  listTenantUsageRecords,
  resumeTenantSubscription,
  startTenantBillingTrial,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, shadow } from "@/lib/theme/tokens";
import type {
  BillingAccountStatus,
  BillingEntitlements,
  BillingInvoice,
  BillingPlan,
  BillingUsageRecord,
  BillingUsageSummary,
  SiteSubscription,
} from "@/lib/types";

type BusyAction = "" | "confirm" | "portal" | "cancel" | "resume" | `checkout:${string}` | `trial:${string}` | `change:${string}`;
type CheckoutProvider = "stripe" | "paystack";
type TenantBillingEventPage = NonNullable<Awaited<ReturnType<typeof listTenantBillingEvents>>>;
type TenantBillingEvent = TenantBillingEventPage["data"][number];
type PendingCheckout = {
  provider: CheckoutProvider;
  planId: string;
  planName: string;
  reference?: string;
  sessionId?: string;
};

export function BillingScreen() {
  const { accessToken } = useAuthSession();
  const [account, setAccount] = useState<BillingAccountStatus | null>(null);
  const [busy, setBusy] = useState<BusyAction>("");
  const [currency, setCurrency] = useState("USD");
  const [entitlements, setEntitlements] = useState<BillingEntitlements | null>(null);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [billingEvents, setBillingEvents] = useState<TenantBillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [seatCount, setSeatCount] = useState(1);
  const [subscription, setSubscription] = useState<SiteSubscription | null>(null);
  const [usageRecords, setUsageRecords] = useState<BillingUsageRecord[]>([]);
  const [usageSummary, setUsageSummary] = useState<BillingUsageSummary | null>(null);
  const handledCheckoutUrlsRef = useRef(new Set<string>());

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [planPage, accountResult, currentResult, entitlementResult, invoicePage, usagePage, summaryResult, eventPage] = await Promise.all([
        listBillingPlans(accessToken, { includeInactive: false, limit: 100 }),
        getBillingAccountStatus(accessToken),
        getCurrentTenantSubscription(accessToken),
        getTenantEntitlements(accessToken),
        listTenantInvoices(accessToken, { limit: 20 }),
        listTenantUsageRecords(accessToken, { limit: 30 }),
        getTenantUsageSummary(accessToken, { limit: 30 }),
        listTenantBillingEvents(accessToken, { limit: 8 }),
      ]);

      setPlans(planPage.data);
      setAccount(accountResult);
      setSubscription(currentResult);
      setEntitlements(entitlementResult);
      setInvoices(invoicePage.data);
      setUsageRecords(usagePage.data);
      setUsageSummary(summaryResult);
      setBillingEvents(eventPage?.data ?? []);
      setSeatCount(Math.max(currentResult?.seatCount ?? accountResult.seats.used ?? 1, 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load billing.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentPlanId = subscription?.planId ?? entitlements?.plan?.id ?? account?.subscription?.planId ?? "";
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === currentPlanId) ?? subscription?.plan ?? null,
    [currentPlanId, plans, subscription?.plan],
  );
  const currencies = useMemo(() => Array.from(new Set(["USD", "NGN", ...plans.map((plan) => plan.currency.toUpperCase())])), [plans]);
  const visiblePlans = useMemo(
    () => plans.filter((plan) => plan.currency.toUpperCase() === currency),
    [currency, plans],
  );
  const usageByKey = useMemo(
    () => new Map((usageSummary?.data ?? []).map((item) => [item.featureKey, item])),
    [usageSummary],
  );

  useEffect(() => {
    if (!currencies.includes(currency)) {
      setCurrency(currencies[0] ?? "USD");
    }
  }, [currencies, currency]);

  const handleCheckoutReturn = useCallback(async (url: string) => {
    if (!accessToken || handledCheckoutUrlsRef.current.has(url)) return;

    const queryString = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
    const params = new URLSearchParams(queryString);
    const checkout = params.get("checkout");
    const isBillingReturn = url.toLowerCase().includes("billing/success") || url.toLowerCase().includes("billing/cancelled") || Boolean(checkout);
    if (!isBillingReturn) return;

    handledCheckoutUrlsRef.current.add(url);
    if (checkout === "cancelled" || url.toLowerCase().includes("billing/cancelled")) {
      setPendingCheckout(null);
      setMessage({ ok: false, text: "Checkout cancelled. No billing changes were applied." });
      return;
    }

    const reference = params.get("reference") ?? params.get("trxref") ?? undefined;
    const sessionId = params.get("session_id") ?? params.get("sessionId") ?? undefined;
    const providerParam = params.get("provider");
    const provider =
      providerParam === "paystack" || reference
        ? "paystack"
        : providerParam === "stripe" || sessionId
          ? "stripe"
          : undefined;

    setBusy("confirm");
    setMessage(null);
    try {
      await confirmBillingCheckout(accessToken, { provider, reference, sessionId });
      setPendingCheckout(null);
      setMessage({ ok: true, text: "Payment confirmed. Your subscription is active." });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to confirm checkout." });
    } finally {
      setBusy("");
    }
  }, [accessToken, load]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleCheckoutReturn(url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void handleCheckoutReturn(url);
    });
    return () => subscription.remove();
  }, [handleCheckoutReturn]);

  async function openPortal() {
    if (!accessToken || !subscription) return;
    setBusy("portal");
    setMessage(null);
    try {
      const session = await createBillingPortal(accessToken, {});
      if (typeof session.url === "string" && session.url) {
        await Linking.openURL(session.url);
        setMessage({ ok: true, text: "Billing portal opened." });
      } else {
        setMessage({ ok: false, text: session.message ?? "Billing portal is not available for this subscription." });
      }
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to open billing portal." });
    } finally {
      setBusy("");
    }
  }

  async function startTrial(plan: BillingPlan) {
    if (!accessToken) return;
    setBusy(`trial:${plan.id}`);
    setMessage(null);
    try {
      const next = await startTenantBillingTrial(accessToken, { planId: plan.id, seatCount });
      setSubscription(next);
      setMessage({ ok: true, text: `${plan.name} trial started.` });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to start trial." });
    } finally {
      setBusy("");
    }
  }

  async function checkout(plan: BillingPlan) {
    if (!accessToken) return;
    setBusy(`checkout:${plan.id}`);
    setMessage(null);
    try {
      const provider = plan.currency.toUpperCase() === "NGN" ? "paystack" : "stripe";
      const returnUrl = ExpoLinking.createURL("billing");
      const session = await createBillingCheckout(accessToken, {
        cancelUrl: ExpoLinking.createURL("billing/cancelled"),
        planId: plan.id,
        provider,
        seatCount,
        successUrl: ExpoLinking.createURL("billing/success"),
      });
      const pending = checkoutSessionToPending(session, plan, provider);
      setPendingCheckout(pending);
      if (typeof session.url === "string" && session.url) {
        const result = await WebBrowser.openAuthSessionAsync(session.url, returnUrl);
        if (result.type === "success") {
          await handleCheckoutReturn(result.url);
        } else {
          setMessage({ ok: true, text: "Checkout opened. If payment completed but the app did not return, tap Confirm payment below." });
        }
      } else {
        setPendingCheckout(null);
        setMessage({ ok: true, text: session.message ?? "Checkout prepared." });
      }
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to start checkout." });
    } finally {
      setBusy("");
    }
  }

  async function confirmPendingCheckout() {
    if (!accessToken || !pendingCheckout) return;
    setBusy("confirm");
    setMessage(null);
    try {
      await confirmBillingCheckout(accessToken, {
        provider: pendingCheckout.provider,
        reference: pendingCheckout.reference,
        sessionId: pendingCheckout.sessionId,
      });
      setPendingCheckout(null);
      setMessage({ ok: true, text: "Payment confirmed. Your subscription is active." });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to confirm payment yet." });
    } finally {
      setBusy("");
    }
  }

  async function changePlan(plan: BillingPlan) {
    if (!accessToken || !subscription) return;
    setBusy(`change:${plan.id}`);
    setMessage(null);
    try {
      const next = await changeTenantSubscriptionPlan(accessToken, subscription.id, { planId: plan.id });
      setSubscription(next);
      setMessage({ ok: true, text: `Changed to ${plan.name}.` });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to change plan." });
    } finally {
      setBusy("");
    }
  }

  function confirmCancel() {
    if (!subscription) return;
    Alert.alert("Cancel subscription?", "The subscription will be marked cancelled in TaskBricks billing.", [
      { style: "cancel", text: "Keep plan" },
      { onPress: () => void cancelOrResume("cancel"), style: "destructive", text: "Cancel" },
    ]);
  }

  async function cancelOrResume(action: "cancel" | "resume") {
    if (!accessToken || !subscription) return;
    setBusy(action);
    setMessage(null);
    try {
      const next = action === "cancel"
        ? await cancelTenantSubscription(accessToken, subscription.id)
        : await resumeTenantSubscription(accessToken, subscription.id);
      setSubscription(next);
      setMessage({ ok: true, text: action === "cancel" ? "Subscription cancelled." : "Subscription resumed." });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to update subscription." });
    } finally {
      setBusy("");
    }
  }

  async function openInvoice(invoice: BillingInvoice) {
    const url = invoice.hostedInvoiceUrl ?? invoice.invoicePdfUrl;
    if (!url) return;
    await Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.heroIconBtn}>
              <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>Billing</Text>
              <Text numberOfLines={1} style={styles.heroTitle}>Plan control</Text>
              <Text numberOfLines={2} style={styles.heroSub}>Manage seats, plans, invoices, and entitlements.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.heroIconBtn}>
              <RefreshCw color={colors.foreground} size={19} strokeWidth={2.7} />
            </Pressable>
          </View>

          <View style={styles.planHero}>
            <View style={styles.planIcon}>
              <WalletCards color={colors.black} size={22} strokeWidth={2.8} />
            </View>
            <View style={styles.planCopy}>
              <Text style={styles.planLabel}>Current plan</Text>
              <Text numberOfLines={1} style={styles.planName}>{currentPlan?.name ?? entitlements?.plan?.name ?? "No plan"}</Text>
              <Text numberOfLines={1} style={styles.planMeta}>{subscription?.status ?? "Not subscribed"} - {formatDate(subscription?.trialEndsAt ?? subscription?.currentPeriodEnd)}</Text>
            </View>
          </View>

          <View style={styles.heroMetrics}>
            <Metric value={account?.seats.used ?? 0} label="Seats" />
            <View style={styles.heroDivider} />
            <Metric value={entitlements?.features.length ?? 0} label="Features" />
            <View style={styles.heroDivider} />
            <Metric value={usageSummary?.totalQuantity ?? 0} label="Usage" />
          </View>

          <View style={styles.heroActions}>
            <Pressable accessibilityRole="button" disabled={!subscription || busy === "portal"} onPress={() => void openPortal()} style={[styles.primaryAction, !subscription && styles.disabledBtn]}>
              {busy === "portal" ? <ActivityIndicator color={colors.black} size="small" /> : <WalletCards color={colors.black} size={17} strokeWidth={2.8} />}
              <Text style={styles.primaryActionText}>Portal</Text>
            </Pressable>
            <Stepper value={seatCount} onChange={setSeatCount} />
          </View>
        </View>

        <View style={styles.body}>
          <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
            {currencies.map((item) => (
              <Chip active={currency === item} key={item} label={item} onPress={() => setCurrency(item)} />
            ))}
          </ScrollView>

          {message ? (
            <Pressable accessibilityRole="button" onPress={() => setMessage(null)} style={[styles.notice, message.ok ? styles.noticeOk : styles.noticeBad]}>
              <Text style={[styles.noticeText, message.ok ? styles.noticeTextOk : styles.noticeTextBad]}>{message.text}</Text>
              <X color={message.ok ? colors.success : colors.danger} size={15} strokeWidth={2.7} />
            </Pressable>
          ) : null}

          {pendingCheckout ? (
            <View style={styles.pendingCheckout}>
              <View style={styles.pendingIcon}>
                <CreditCard color={colors.black} size={18} strokeWidth={2.8} />
              </View>
              <View style={styles.pendingCopy}>
                <Text style={styles.pendingTitle}>Payment waiting for confirmation</Text>
                <Text numberOfLines={2} style={styles.pendingText}>
                  {pendingCheckout.planName} through {pendingCheckout.provider === "paystack" ? "Paystack" : "Stripe"}
                </Text>
              </View>
              <Pressable accessibilityRole="button" disabled={busy === "confirm"} onPress={() => void confirmPendingCheckout()} style={[styles.pendingButton, busy === "confirm" && styles.disabledBtn]}>
                {busy === "confirm" ? <ActivityIndicator color={colors.black} size="small" /> : <CheckCircle2 color={colors.black} size={16} strokeWidth={2.8} />}
                <Text style={styles.pendingButtonText}>Confirm</Text>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void load()} />
          ) : (
            <View style={styles.stack}>
              <View style={styles.kpiGrid}>
                <KpiTile icon={<PackageCheck color={colors.accent} size={18} strokeWidth={2.7} />} label="Plan" tone="blue" value={currentPlan?.name ?? "None" } />
                <KpiTile icon={<BadgeCheck color={subscription?.status === "ACTIVE" ? colors.success : colors.warning} size={18} strokeWidth={2.7} />} label="Status" tone={subscription?.status === "ACTIVE" ? "green" : "yellow"} value={subscription?.status ?? "None"} />
              </View>

              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Plans</Text>
                  <Text style={styles.sectionSub}>{visiblePlans.length} available for {currency}</Text>
                </View>
              </View>

              {visiblePlans.length ? visiblePlans.map((plan) => (
                <PlanCard
                  busy={busy}
                  current={currentPlanId === plan.id}
                  hasSubscription={Boolean(subscription)}
                  key={plan.id}
                  onChange={() => void changePlan(plan)}
                  onCheckout={() => void checkout(plan)}
                  onStartTrial={() => void startTrial(plan)}
                  plan={plan}
                />
              )) : <EmptyBlock icon={<CreditCard color={colors.accent} size={30} strokeWidth={2.5} />} text={`No active ${currency} plans are available.`} title="No plans" />}

              <Panel actionLabel={subscription?.status === "CANCELLED" ? "Resume" : "Cancel"} onAction={subscription?.status === "CANCELLED" ? () => void cancelOrResume("resume") : confirmCancel} title="Subscription control">
                <StatusLine label="Provider" value={subscription?.provider ?? "none"} />
                <StatusLine label="Seats" value={`${subscription?.seatCount ?? seatCount}`} />
                <StatusLine label="Current period" value={`${formatDate(subscription?.currentPeriodStart)} - ${formatDate(subscription?.currentPeriodEnd)}`} />
                <StatusLine label="Trial ends" value={formatDate(subscription?.trialEndsAt)} />
              </Panel>

              <Panel actionLabel={`${entitlements?.features.length ?? 0}`} title="Entitlements">
                {(entitlements?.features ?? []).length ? entitlements?.features.map((feature) => {
                  const usage = usageByKey.get(feature.key);
                  const used = usage?.quantity ?? feature.used;
                  const percent = feature.limit ? Math.min(Math.round((used / feature.limit) * 100), 100) : feature.allowed ? 18 : 0;
                  return (
                    <View key={feature.key} style={styles.featureRow}>
                      <View style={styles.rowBetween}>
                        <View style={styles.featureMain}>
                          <Text numberOfLines={1} style={styles.rowTitle}>{feature.name}</Text>
                          <Text numberOfLines={1} style={styles.rowMeta}>{feature.key}</Text>
                        </View>
                        <FeatureBadge allowed={feature.allowed} />
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: feature.allowed ? colors.black : colors.danger }]} />
                      </View>
                      <View style={styles.rowBetween}>
                        <Text style={styles.rowMeta}>{used} used</Text>
                        <Text style={styles.rowMeta}>{limitLabel(feature.limit, feature.unit)}</Text>
                      </View>
                    </View>
                  );
                }) : <EmptyBlock icon={<ShieldCheck color={colors.accent} size={30} strokeWidth={2.5} />} text="Start a trial or subscribe to activate limits." title="No entitlements" />}
              </Panel>

              <Panel actionLabel={`${usageSummary?.totalRecords ?? 0}`} title="Recent usage">
                {usageRecords.length ? usageRecords.slice(0, 10).map((record) => (
                  <View key={record.id} style={styles.compactRow}>
                    <View style={styles.featureMain}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{record.featureKey}</Text>
                      <Text numberOfLines={1} style={styles.rowMeta}>{record.source} - {formatDate(record.createdAt)}</Text>
                    </View>
                    <Text style={styles.rowValue}>{record.quantity} {record.unit ?? ""}</Text>
                  </View>
                )) : <EmptyBlock icon={<Gauge color={colors.accent} size={30} strokeWidth={2.5} />} text="Metered usage appears after features are consumed." title="No usage yet" />}
              </Panel>

              <Panel actionLabel={`${billingEvents.length}`} title="Provider reliability">
                {billingEvents.length ? billingEvents.map((event) => (
                  <View key={event.id} style={styles.eventRow}>
                    <View style={styles.rowBetween}>
                      <View style={styles.featureMain}>
                        <Text numberOfLines={1} style={styles.rowTitle}>{event.type}</Text>
                        <Text numberOfLines={1} style={styles.rowMeta}>{event.provider} - {event.eventId}</Text>
                      </View>
                      <EventStatusPill status={event.status} />
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.rowMeta}>{formatDate(event.processedAt ?? event.createdAt)}</Text>
                      <Text numberOfLines={1} style={[styles.rowMeta, event.error ? styles.eventErrorText : null]}>
                        {event.error ?? "Provider event accepted"}
                      </Text>
                    </View>
                  </View>
                )) : <EmptyBlock icon={<RefreshCw color={colors.accent} size={30} strokeWidth={2.5} />} text="Stripe and Paystack callbacks appear here after checkout or renewal." title="No provider events" />}
              </Panel>

              <Panel actionLabel={`${invoices.length}`} title="Invoices">
                {invoices.length ? invoices.map((invoice) => (
                  <Pressable accessibilityRole="button" disabled={!invoice.hostedInvoiceUrl && !invoice.invoicePdfUrl} key={invoice.id} onPress={() => void openInvoice(invoice)} style={styles.invoiceRow}>
                    <View style={styles.invoiceIcon}>
                      <FileText color={colors.accent} size={18} strokeWidth={2.6} />
                    </View>
                    <View style={styles.featureMain}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{invoice.number ?? invoice.providerInvoiceId ?? invoice.id.slice(0, 8)}</Text>
                      <Text numberOfLines={1} style={styles.rowMeta}>{invoice.provider} - {formatDate(invoice.createdAt)}</Text>
                    </View>
                    <View style={styles.invoiceRight}>
                      <Text style={styles.rowValue}>{formatMoney(invoice.amount, invoice.currency)}</Text>
                      <Text style={styles.invoiceStatus}>{invoice.status}</Text>
                    </View>
                    {(invoice.hostedInvoiceUrl || invoice.invoicePdfUrl) ? <ExternalLink color={colors.inkSoft} size={15} strokeWidth={2.6} /> : null}
                  </Pressable>
                )) : <EmptyBlock icon={<FileText color={colors.accent} size={30} strokeWidth={2.5} />} text="Invoices appear after checkout, renewal, or manual billing events." title="No invoices yet" />}
              </Panel>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function Stepper({ onChange, value }: { onChange: (value: number) => void; value: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" onPress={() => onChange(Math.max(value - 1, 1))} style={styles.stepperBtn}>
        <Text style={styles.stepperBtnText}>-</Text>
      </Pressable>
      <View style={styles.stepperValue}>
        <Text style={styles.stepperNumber}>{value}</Text>
        <Text style={styles.stepperLabel}>seats</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => onChange(value + 1)} style={styles.stepperBtn}>
        <Text style={styles.stepperBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function PlanCard({
  busy,
  current,
  hasSubscription,
  onChange,
  onCheckout,
  onStartTrial,
  plan,
}: {
  busy: BusyAction;
  current: boolean;
  hasSubscription: boolean;
  onChange: () => void;
  onCheckout: () => void;
  onStartTrial: () => void;
  plan: BillingPlan;
}) {
  const actionBusy = busy === `checkout:${plan.id}` || busy === `trial:${plan.id}` || busy === `change:${plan.id}`;
  const price = Number(plan.price) || 0;

  return (
    <View style={[styles.planCard, current && styles.planCardCurrent]}>
      <View style={styles.rowBetween}>
        <View style={styles.featureMain}>
          <Text numberOfLines={1} style={styles.planCardTitle}>{plan.name}</Text>
          <Text style={styles.planCardMeta}>{plan.interval} - {plan.currency}</Text>
        </View>
        {current ? <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View> : null}
      </View>
      <Text numberOfLines={2} style={styles.planDescription}>{plan.description || "Governed workspace plan with limits and metered usage."}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceText}>{formatMoney(plan.price, plan.currency)}</Text>
        <Text style={styles.priceMeta}>/{plan.interval.toLowerCase()}</Text>
      </View>
      <View style={styles.planFacts}>
        <Text style={styles.planFact}>{plan.seatLimit ? `${plan.seatLimit} seats` : "Flexible seats"}</Text>
        <Text style={styles.planFact}>{plan.trialDays ? `${plan.trialDays} day trial` : "No trial"}</Text>
        <Text style={styles.planFact}>{plan._count?.features ?? plan.features?.length ?? 0} features</Text>
      </View>
      <View style={styles.planActions}>
        {!hasSubscription ? (
          <>
            {plan.trialDays ? <PlanButton busy={actionBusy} label="Trial" onPress={onStartTrial} /> : null}
            <PlanButton busy={actionBusy} label="Checkout" onPress={onCheckout} primary />
          </>
        ) : current ? (
          <PlanButton label="Manage" onPress={onCheckout} />
        ) : (
          <PlanButton busy={actionBusy} label={price > 0 ? "Checkout switch" : "Change plan"} onPress={price > 0 ? onCheckout : onChange} primary />
        )}
      </View>
    </View>
  );
}

function PlanButton({ busy, label, onPress, primary }: { busy?: boolean; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.planButton, primary && styles.planButtonPrimary, busy && styles.disabledBtn]}>
      {busy ? <ActivityIndicator color={primary ? colors.black : colors.foreground} size="small" /> : null}
      <Text style={[styles.planButtonText, primary && styles.planButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function Panel({
  actionLabel,
  children,
  onAction,
  title,
}: {
  actionLabel?: string;
  children: React.ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        {actionLabel ? (
          <Pressable accessibilityRole="button" disabled={!onAction} onPress={onAction} style={styles.panelAction}>
            <Text style={styles.panelActionText}>{actionLabel}</Text>
            {onAction ? <ChevronRight color={colors.accent} size={14} strokeWidth={2.7} /> : null}
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function KpiTile({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "blue" | "green" | "yellow";
  value: string;
}) {
  return (
    <View style={[styles.kpiTile, { backgroundColor: toneSoft(tone) }]}>
      {icon}
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FeatureBadge({ allowed }: { allowed: boolean }) {
  return (
    <View style={[styles.featureBadge, allowed ? styles.featureBadgeAllowed : styles.featureBadgeBlocked]}>
      <Text style={[styles.featureBadgeText, allowed ? styles.featureBadgeTextAllowed : styles.featureBadgeTextBlocked]}>{allowed ? "Available" : "Blocked"}</Text>
    </View>
  );
}

function EventStatusPill({ status }: { status: string }) {
  const toneStyle =
    status === "PROCESSED" ? styles.eventStatusProcessed
      : status === "RECEIVED" ? styles.eventStatusReceived
        : status === "FAILED" ? styles.eventStatusFailed
          : styles.eventStatusIgnored;
  const textStyle =
    status === "PROCESSED" ? styles.eventStatusTextProcessed
      : status === "RECEIVED" ? styles.eventStatusTextReceived
        : status === "FAILED" ? styles.eventStatusTextFailed
          : styles.eventStatusTextIgnored;
  return (
    <View style={[styles.eventStatus, toneStyle]}>
      <Text style={[styles.eventStatusText, textStyle]}>{status}</Text>
    </View>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusLineLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statusLineValue}>{value}</Text>
    </View>
  );
}

function EmptyBlock({ icon, text, title }: { icon: React.ReactNode; text: string; title: string }) {
  return (
    <View style={styles.emptyBox}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.stateTitle}>Loading billing</Text>
      <Text style={styles.stateText}>Fetching plans, subscription, invoices, and usage.</Text>
    </View>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>Billing unavailable</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function checkoutSessionToPending(
  session: Awaited<ReturnType<typeof createBillingCheckout>>,
  plan: BillingPlan,
  fallbackProvider: CheckoutProvider,
): PendingCheckout {
  const sessionRecord = session as Record<string, unknown>;
  const provider =
    sessionRecord.provider === "paystack" || sessionRecord.provider === "stripe"
      ? sessionRecord.provider
      : fallbackProvider;
  const id = stringValue(sessionRecord.id);
  const reference = stringValue(sessionRecord.reference) ?? (provider === "paystack" ? id : undefined);
  const sessionId = provider === "stripe" ? id : undefined;

  return {
    provider,
    planId: plan.id,
    planName: plan.name,
    reference,
    sessionId,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formatMoney(value: number | string, currency: string) {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat(undefined, { currency, maximumFractionDigits: 0, style: "currency" }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function limitLabel(limit?: number | null, unit?: string | null) {
  if (limit === null || limit === undefined) return unit ? `Unlimited ${unit}` : "Unlimited";
  return `${limit} ${unit ?? "included"}`;
}

function toneSoft(tone: "blue" | "green" | "yellow") {
  if (tone === "green") return colors.greenSoft;
  if (tone === "yellow") return colors.yellowSoft;
  return colors.blueSoft;
}

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.background, flex: 1 },
  scroller: { backgroundColor: colors.background },
  content: { paddingBottom: 128 },
  hero: {
    backgroundColor: colors.background,
    paddingBottom: 10,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  heroTop: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  heroIconBtn: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadow.card,
  },
  heroTitleWrap: { flex: 1, gap: 4, paddingTop: 1 },
  heroEyebrow: { color: colors.accent, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  heroTitle: { color: colors.foreground, fontSize: 26, fontWeight: "900" },
  heroSub: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  planHero: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 18,
    padding: 16,
    ...shadow.card,
  },
  planIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  planCopy: { flex: 1 },
  planLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  planName: { color: colors.foreground, fontSize: 21, fontWeight: "900", marginTop: 2 },
  planMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 2 },
  heroMetrics: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...shadow.card,
  },
  heroMetric: { alignItems: "center", flex: 1 },
  heroMetricValue: { color: colors.foreground, fontSize: 23, fontWeight: "900" },
  heroMetricLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", marginTop: 4, textTransform: "uppercase" },
  heroDivider: { backgroundColor: colors.line, height: 34, width: 1 },
  heroActions: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 18 },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  primaryActionText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  stepper: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  stepperBtn: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 12,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  stepperBtnText: { color: colors.foreground, fontSize: 18, fontWeight: "900" },
  stepperValue: { alignItems: "center", minWidth: 54 },
  stepperNumber: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  stepperLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  body: { paddingHorizontal: 22, paddingTop: 12 },
  filterRail: { gap: 9, paddingBottom: 16 },
  chip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 16,
  },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "900" },
  chipTextActive: { color: colors.white },
  notice: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeOk: { backgroundColor: colors.greenSoft, borderColor: "#bbf7d0" },
  noticeBad: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  noticeText: { flex: 1, fontSize: 13, fontWeight: "900" },
  noticeTextOk: { color: colors.success },
  noticeTextBad: { color: colors.danger },
  pendingCheckout: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    padding: 14,
    ...shadow.card,
  },
  pendingIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  pendingCopy: { flex: 1 },
  pendingTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  pendingText: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", lineHeight: 16, marginTop: 3 },
  pendingButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 15,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  pendingButtonText: { color: colors.black, fontSize: 12, fontWeight: "900" },
  stack: { gap: 16 },
  kpiGrid: { flexDirection: "row", gap: 10 },
  kpiTile: {
    borderColor: "rgba(0,0,0,0.04)",
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 112,
    padding: 15,
  },
  kpiValue: { color: colors.foreground, fontSize: 21, fontWeight: "900", marginTop: 10 },
  kpiLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", marginTop: 4, textTransform: "uppercase" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: colors.foreground, fontSize: 22, fontWeight: "900" },
  sectionSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 3 },
  planCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    ...shadow.card,
  },
  planCardCurrent: { borderColor: colors.primary, borderWidth: 2 },
  rowBetween: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  featureMain: { flex: 1 },
  planCardTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900" },
  planCardMeta: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  currentBadge: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  currentBadgeText: { color: colors.black, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  planDescription: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 13 },
  priceRow: { alignItems: "flex-end", flexDirection: "row", gap: 5, marginTop: 14 },
  priceText: { color: colors.foreground, fontSize: 27, fontWeight: "900" },
  priceMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "900", marginBottom: 4 },
  planFacts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  planFact: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  planActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  planButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 15,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
  },
  planButtonPrimary: { backgroundColor: colors.primary },
  planButtonText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  planButtonTextPrimary: { color: colors.black },
  panel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    ...shadow.card,
  },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  panelTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900" },
  panelAction: { alignItems: "center", flexDirection: "row", gap: 2 },
  panelActionText: { color: colors.accent, fontSize: 13, fontWeight: "900" },
  statusLine: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 11 },
  statusLineLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  statusLineValue: { color: colors.foreground, flex: 1, fontSize: 12, fontWeight: "900", marginLeft: 12, textAlign: "right" },
  featureRow: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: 9, paddingVertical: 12 },
  rowTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  rowMeta: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", marginTop: 2 },
  rowValue: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  featureBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  featureBadgeAllowed: { backgroundColor: colors.greenSoft },
  featureBadgeBlocked: { backgroundColor: colors.redSoft },
  featureBadgeText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  featureBadgeTextAllowed: { color: colors.success },
  featureBadgeTextBlocked: { color: colors.danger },
  eventRow: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: 8, paddingVertical: 12 },
  eventErrorText: { color: colors.danger, flex: 1, marginLeft: 12, textAlign: "right" },
  eventStatus: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  eventStatusProcessed: { backgroundColor: colors.greenSoft },
  eventStatusReceived: { backgroundColor: colors.blueSoft },
  eventStatusFailed: { backgroundColor: colors.redSoft },
  eventStatusIgnored: { backgroundColor: colors.yellowSoft },
  eventStatusText: { fontSize: 9, fontWeight: "900" },
  eventStatusTextProcessed: { color: colors.success },
  eventStatusTextReceived: { color: colors.accent },
  eventStatusTextFailed: { color: colors.danger },
  eventStatusTextIgnored: { color: "#8a6500" },
  progressTrack: { backgroundColor: colors.panelMuted, borderRadius: 999, height: 8, overflow: "hidden" },
  progressFill: { borderRadius: 999, height: "100%" },
  compactRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, justifyContent: "space-between", paddingVertical: 13 },
  invoiceRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 13 },
  invoiceIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 15, height: 42, justifyContent: "center", width: 42 },
  invoiceRight: { alignItems: "flex-end" },
  invoiceStatus: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  emptyBox: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 20, padding: 22 },
  emptyTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900", marginTop: 10 },
  emptyText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 4, textAlign: "center" },
  stateBox: { alignItems: "center", backgroundColor: colors.white, borderRadius: 24, gap: 8, padding: 30, ...shadow.card },
  stateTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900", marginTop: 6 },
  stateText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", textAlign: "center" },
  errorBox: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: 24, borderWidth: 1, padding: 18 },
  errorTitle: { color: colors.danger, fontSize: 18, fontWeight: "900" },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800", marginTop: 6 },
  retryBtn: { alignSelf: "flex-start", backgroundColor: colors.danger, borderRadius: 14, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  disabledBtn: { opacity: 0.45 },
}));
