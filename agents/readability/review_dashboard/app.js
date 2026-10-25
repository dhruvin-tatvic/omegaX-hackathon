(() => {
  const REPO_PREFIX = window.TATVIC_ARTIFACT_PREFIX || "../../../";
  const MANIFEST_URL = window.TATVIC_HUMAN_MANIFEST || "manifest.json";
  const THEME_KEY = "tatvic-human-view-theme";
  const FACT_LABELS = {
    ex_showroom_price: "Ex-showroom price",
    starting_price: "Starting price",
    on_road_price: "On-road price",
    original_price: "Original price",
    discounted_price: "Discounted price",
    cash_discount: "Cash discount",
    cashback: "Cashback",
    accessories_value: "Accessories value",
    down_payment: "Down payment",
    monthly_emi: "Monthly EMI",
    insurance_cost: "Insurance cost",
    registration_cost: "Registration cost",
    processing_fee: "Processing fee",
    annual_interest_rate_pct: "Annual interest rate",
    loan_tenure_months: "Loan tenure",
    financing_partner: "Financing partner",
    offer_valid_until: "Offer valid until",
    variant_name: "Variant",
    engine: "Engine",
    power: "Power",
    torque: "Torque",
    mileage: "Mileage",
    specification: "Specification",
    feature: "Feature",
    tagline: "Tagline",
    question: "Question",
    answer: "Answer",
    phone: "Phone",
    email: "Email",
    address: "Address",
    city: "City",
    hours: "Hours",
    name: "Name",
    offer_term: "Offer term",
  };
  const CATEGORY_LABELS = {
    homepage: "Homepage",
    product_listing: "Product listing",
    product_detail: "Product detail",
    offers: "Offers",
    finance: "Finance",
    dealer_listing: "Dealer listing",
    dealer_detail: "Dealer detail",
    faq: "FAQ",
    about: "About",
    contact: "Contact",
    booking: "Booking",
    account: "Account",
    authentication: "Authentication",
    other: "Other",
  };
  const STATUS_LABELS = { success: "Success", partial: "Partial", error: "Failed", failed: "Failed" };
  const PRICE_TYPES = new Set([
    "ex_showroom_price",
    "starting_price",
    "on_road_price",
    "original_price",
    "discounted_price",
    "cash_discount",
    "cashback",
    "accessories_value",
    "insurance_cost",
    "registration_cost",
    "processing_fee",
  ]);
  const SPEC_TYPES = new Set(["engine", "power", "torque", "mileage", "specification"]);
  const FINANCE_TYPES = new Set([
    "down_payment",
    "monthly_emi",
    "annual_interest_rate_pct",
    "loan_tenure_months",
    "financing_partner",
  ]);
  const state = {
    report: null,
    pages: [],
    selected: null,
    manifest: null,
  };

  const $ = (id) => document.getElementById(id);

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    const toggle = $("theme-toggle");
    if (toggle) {
      const label = next === "dark" ? "Switch to light theme" : "Switch to dark theme";
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("title", label);
    }
  }

  function initTheme() {
    let saved = "light";
    try {
      saved = localStorage.getItem(THEME_KEY) || "light";
    } catch {
      saved = "light";
    }
    applyTheme(saved);
  }

  function artifactUrl(relPath) {
    if (!relPath) return "";
    return REPO_PREFIX + String(relPath).replace(/^\/+/, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function humanize(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function categoryLabel(type) {
    return CATEGORY_LABELS[type] || humanize(type) || "Other";
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || humanize(status) || "Unknown";
  }

  function formatIst(value) {
    if (value == null || value === "") return "n/a";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const bag = {};
    for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
    const day = String(Number(bag.day));
    const hour = String(Number(bag.hour));
    const minute = bag.minute || "00";
    const period = String(bag.dayPeriod || "AM").replace(/\./g, "").replace(/\s/g, "").toUpperCase();
    return `${day} ${bag.month} ${bag.year}, ${hour}:${minute} ${period} IST`;
  }

  function formatInr(value) {
    if (typeof value !== "number") return String(value ?? "");
    return "₹" + value.toLocaleString("en-IN");
  }

  function formatFactValue(fact) {
    if (fact == null) return "Not available";
    if (fact.currency === "INR" && typeof fact.value === "number") return formatInr(fact.value);
    if (fact.fact_type === "annual_interest_rate_pct") return `${fact.value}%`;
    if (fact.fact_type === "loan_tenure_months") return `${fact.value} months`;
    const text = fact.value_text || fact.value;
    if (text == null || text === "") return "Not available";
    return String(text);
  }

  function formatQualifier(qualifier) {
    if (!qualifier || typeof qualifier !== "object") return "";
    return Object.entries(qualifier)
      .filter(([, value]) => value != null && value !== "")
      .map(([key, value]) => `${humanize(key)}: ${value}`)
      .join(" · ");
  }

  function pathLabel(url) {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search || parsed.href;
    } catch {
      return url || "n/a";
    }
  }

  function displayTitle(page) {
    const path = page.canonical_path || "";
    if (page.page_type === "homepage" || path === "/" || path === "") return "Home";
    const product = ((page.structured_facts || {}).entities || []).find(
      (entity) => entity.type === "product" && !entity.variant_of
    );
    if (page.page_type === "product_detail" && product?.name) return product.name;
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 1) return humanize(segments[0]);
    if (page.page_type === "booking" && page.query?.bike) return `Book test ride · ${humanize(page.query.bike)}`;
    const raw = String(page.page_title || "");
    const cleaned = raw.split("|")[0].split("—")[0].split("–")[0].trim();
    if (cleaned) return cleaned;
    if (segments.length) return humanize(segments[segments.length - 1]);
    return "(untitled)";
  }

  function badge(kind, text) {
    return `<span class="badge ${escapeHtml(kind)}">${escapeHtml(text)}</span>`;
  }

  async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  }

  async function loadText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.text();
  }

  function fillTypeFilter(pages) {
    const select = $("type-filter");
    const types = [...new Set(pages.map((page) => page.page_type).filter(Boolean))].sort();
    const current = select.value;
    select.innerHTML =
      `<option value="">All categories</option>` +
      types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(categoryLabel(type))}</option>`).join("");
    if (types.includes(current)) select.value = current;
  }

  function renderSummary(report) {
    const website = report.base_url || "n/a";
    $("meta-list").innerHTML = [
      ["Website", website, website.startsWith("http") ? website : ""],
      ["Crawl started", formatIst(report.started_at)],
      ["Crawl finished", formatIst(report.finished_at)],
    ]
      .map(([label, value, href]) => {
        const body = href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`
          : escapeHtml(value);
        return `<div><dt>${escapeHtml(label)}</dt><dd>${body}</dd></div>`;
      })
      .join("");

    const cards = [
      ["URLs Discovered", report.total_pages_discovered ?? "n/a"],
      ["Pages Captured", report.total_pages_captured ?? (report.pages || []).length],
      ["Failed Pages", report.total_pages_failed ?? 0],
      ["Skipped URLs", (report.skipped || []).length],
    ];
    $("kpi-grid").innerHTML = cards
      .map(
        ([label, value]) =>
          `<article class="kpi"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></article>`
      )
      .join("");

    const exhausted = report.stopped_reason === "queue_exhausted";
    const status = $("crawl-status");
    status.hidden = false;
    status.textContent = exhausted ? "Crawl completed" : "Crawl stopped";
    status.className = `status-pill ${exhausted ? "ok" : "warn"}`;
    status.title = exhausted
      ? "The crawler had no remaining internal HTML URLs in its queue. This does not mean the entire website was captured."
      : report.stopped_reason_label || report.stopped_reason || "The crawl ended before the queue was empty.";

    const warnings = report.warnings || [];
    const box = $("warnings-box");
    const list = $("warnings-list");
    if (!warnings.length) {
      box.hidden = true;
      list.innerHTML = "";
      return;
    }
    box.hidden = false;
    $("warnings-count").textContent = String(warnings.length);
    list.innerHTML = warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function renderCategories(report) {
    const counts = report.page_type_counts || {};
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map((item) => item[1]));
    const selected = $("type-filter").value;
    $("category-chart").innerHTML = entries
      .map(([type, count]) => {
        const active = selected === type ? " selected" : "";
        return `<button type="button" class="cat-row${active}" data-type="${escapeHtml(type)}">
          <span>${escapeHtml(categoryLabel(type))}</span>
          <div class="bar"><i style="width:${(count / max) * 100}%"></i></div>
          <strong>${escapeHtml(count)}</strong>
        </button>`;
      })
      .join("");
    $("clear-category").hidden = !selected;
  }

  function filteredPages() {
    const query = $("search").value.trim().toLowerCase();
    const type = $("type-filter").value;
    const status = $("status-filter").value;
    const sortKey = $("sort-filter").value;
    const rows = state.pages.filter((page) => {
      const title = displayTitle(page);
      const hay = `${title} ${page.page_title || ""} ${page.url || ""} ${page.final_url || ""} ${page.canonical_path || ""}`.toLowerCase();
      if (query && !hay.includes(query)) return false;
      if (type && page.page_type !== type) return false;
      if (status && page.status !== status) return false;
      return true;
    });
    rows.sort((a, b) => {
      const left = sortKey === "category" ? categoryLabel(a.page_type) : displayTitle(a);
      const right = sortKey === "category" ? categoryLabel(b.page_type) : displayTitle(b);
      return left.localeCompare(right, undefined, { sensitivity: "base" });
    });
    return rows;
  }

  function renderTable() {
    const rows = filteredPages();
    $("page-count").textContent = `${rows.length} shown · ${state.pages.length} in report`;
    $("pages-empty").hidden = rows.length !== 0;
    const selectedUrl = state.selected?.canonical_path || state.selected?.url;
    $("pages-body").innerHTML = rows
      .map((page) => {
        const originalIndex = state.pages.indexOf(page);
        const url = page.final_url || page.url || "";
        const selected = (page.canonical_path || page.url) === selectedUrl ? " class=\"selected\"" : "";
        return `<tr${selected} data-index="${originalIndex}">
          <td>
            <div class="page-name">${escapeHtml(displayTitle(page))}</div>
            <a class="page-path" href="${escapeHtml(url)}" title="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(pathLabel(url))}</a>
          </td>
          <td>${badge(page.page_type || "other", categoryLabel(page.page_type || "other"))}</td>
          <td>${badge(page.status || "error", statusLabel(page.status || "error"))}</td>
          <td>
            <button class="view-btn" data-index="${originalIndex}">View</button>
            ${
              window.BTA_APP && page.page_type === "product_detail" && page.canonical_path
                ? `<a class="text-btn" href="/readability?slug=${encodeURIComponent(String(page.canonical_path).split("/").filter(Boolean).pop())}">AI vs Human</a>`
                : ""
            }
          </td>
        </tr>`;
      })
      .join("");
    renderCategories(state.report || {});
  }

  function renderOverview(page) {
    const facts = (page.structured_facts || {}).facts || [];
    const entities = (page.structured_facts || {}).entities || [];
    const items = [
      ["Category", categoryLabel(page.page_type)],
      ["Status", statusLabel(page.status)],
      ["Source URL", page.final_url || page.url],
      ["Facts captured", facts.length],
      ["Entities", entities.length],
    ];
    $("tab-overview").innerHTML = `<div class="overview-grid">${items
      .map(([label, value]) => {
        const isUrl = String(value).startsWith("http");
        const body = isUrl
          ? `<a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`
          : escapeHtml(value);
        return `<div class="overview-item"><span>${escapeHtml(label)}</span><strong>${body}</strong></div>`;
      })
      .join("")}</div>
      <p class="muted original-title">Original title: ${escapeHtml(String(page.page_title || "n/a").replace(/[\u2014\u2013]/g, "-"))}</p>`;
  }

  function sectionForFact(fact, entity) {
    const type = fact.fact_type;
    if (PRICE_TYPES.has(type)) return "Pricing";
    if (SPEC_TYPES.has(type)) return "Technical specifications";
    if (type === "feature") return "Features";
    if (type === "variant_name" || entity?.variant_of) return "Variants";
    if (FINANCE_TYPES.has(type)) return "Financing";
    if (["question", "answer"].includes(type)) return "Questions";
    if (["phone", "email", "address", "city", "hours"].includes(type)) return "Availability";
    if (["tagline", "name"].includes(type)) return "Overview";
    if (["offer_term", "offer_valid_until"].includes(type)) return "Offers";
    return "Other information";
  }

  function renderFacts(page) {
    const payload = page.structured_facts || {};
    const facts = payload.facts || [];
    const entities = payload.entities || [];
    if (!facts.length) {
      $("tab-facts").innerHTML = "<p class='muted'>No structured facts were extracted for this page.</p>";
      return;
    }
    const grouped = new Map();
    for (const entity of entities) grouped.set(entity.id, { entity, facts: [] });
    for (const fact of facts) {
      const key = fact.entity_id || "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, {
          entity: { id: key, name: fact.entity_name || "Unassigned", type: fact.entity_type },
          facts: [],
        });
      }
      grouped.get(key).facts.push(fact);
    }

    const isProductPage = page.page_type === "product_detail" || page.page_type === "product_listing";
    $("tab-facts").innerHTML = [...grouped.values()]
      .map(({ entity, facts: rows }) => {
        const sections = new Map();
        for (const fact of rows) {
          const name = isProductPage && entity.type === "product" ? sectionForFact(fact, entity) : sectionForFact(fact, entity);
          if (!sections.has(name)) sections.set(name, []);
          sections.get(name).push(fact);
        }
        const body = [...sections.entries()]
          .filter(([, list]) => list.length)
          .map(([name, list]) => {
            const rowsHtml = list
              .map((fact) => {
                const qualifier = formatQualifier(fact.qualifier);
                const status = fact.status === "ambiguous" ? ` <span class="ambiguous">Needs review</span>` : "";
                return `<div class="fact-row">
                  <div class="k">${escapeHtml(FACT_LABELS[fact.fact_type] || humanize(fact.fact_type))}</div>
                  <div class="v">${escapeHtml(formatFactValue(fact))}${status}</div>
                  ${qualifier ? `<div class="meta">${escapeHtml(qualifier)}</div>` : ""}
                </div>`;
              })
              .join("");
            return `<h4 class="fact-section">${escapeHtml(name)}</h4>${rowsHtml}`;
          })
          .join("");
        const heading = `${entity.name || entity.id}${entity.type ? ` · ${humanize(entity.type)}` : ""}`;
        return `<article class="entity-block"><h3>${escapeHtml(heading)}</h3>${body}</article>`;
      })
      .join("");
  }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach((button) => {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${name}`);
    });
  }

  function exportFacts() {
    if (!state.selected) return;
    const page = state.selected;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schema_version: (page.structured_facts || {}).schema_version || "1.0",
            url: page.url,
            final_url: page.final_url,
            page_type: page.page_type,
            canonical_path: page.canonical_path,
            structured_facts: page.structured_facts,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const link = document.createElement("a");
    const slug = (page.canonical_path || "page").replace(/\W+/g, "-").replace(/^-|-$/g, "") || "page";
    link.href = URL.createObjectURL(blob);
    link.download = `structured-facts-${slug}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function renderScreenshot(page) {
    if (!page.screenshot_path) {
      $("tab-screenshot").innerHTML = "<p class='muted'>No screenshot is available for this page.</p>";
      return;
    }
    const src = artifactUrl(page.screenshot_path);
    $("tab-screenshot").innerHTML = `<figure class="shot-frame">
      <button type="button" class="shot-open" data-src="${escapeHtml(src)}" aria-label="Enlarge screenshot">
        <img class="shot" alt="Captured screenshot of ${escapeHtml(displayTitle(page))}" src="${escapeHtml(src)}" />
      </button>
      <figcaption>
        <a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">Open original image</a>
      </figcaption>
    </figure>`;
  }

  async function showPage(index) {
    const page = state.pages[index];
    if (!page) return;
    state.selected = page;
    $("details").hidden = false;
    $("details-heading").textContent = displayTitle(page);
    $("details-meta").innerHTML = `${badge(page.page_type || "other", categoryLabel(page.page_type || "other"))} ${badge(page.status || "error", statusLabel(page.status || "error"))}`;
    const url = page.final_url || page.url || "";
    $("details-url").innerHTML = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>`
      : "";
    const extra = $("details-links");
    if (extra) {
      extra.innerHTML = "";
      if (window.BTA_APP && page.page_type === "product_detail") {
        const slug = String(page.canonical_path || "").split("/").filter(Boolean).pop();
        extra.innerHTML = `<a href="/readability?slug=${encodeURIComponent(slug)}">Compare AI vs Human Readability</a>`;
      }
    }
    $("tab-json").innerHTML = "";
    $("tab-html").innerHTML = "";
    $("dev-details").open = false;
    renderFacts(page);
    renderOverview(page);
    renderScreenshot(page);
    setTab("overview");
    renderTable();
    $("details").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function loadDeveloper(kind) {
    const page = state.selected;
    if (!page) return;
    const target = kind === "html" ? $("tab-html") : $("tab-json");
    target.innerHTML = "<p class='muted'>Loading…</p>";
    try {
      if (kind === "html") {
        if (!page.rendered_html_path) {
          target.innerHTML = "<p class='muted'>No rendered HTML path on this page.</p>";
          return;
        }
        const html = await loadText(artifactUrl(page.rendered_html_path));
        target.innerHTML = `<pre>${escapeHtml(html)}</pre>`;
        return;
      }
      const original = await loadJson(artifactUrl(page.json_path || page.original_json_path));
      target.innerHTML = `<pre>${escapeHtml(JSON.stringify(original, null, 2))}</pre>`;
    } catch (error) {
      target.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    }
  }

  function clearFilters() {
    $("search").value = "";
    $("type-filter").value = "";
    $("status-filter").value = "";
    $("sort-filter").value = "title";
    renderTable();
  }

  async function init() {
    const status = $("load-status");
    try {
      const manifest = await loadJson(MANIFEST_URL);
      state.manifest = manifest;
      if (manifest.error || !manifest.report_path) {
        throw new Error(manifest.error || "manifest.json has no report_path. Run generate_manifest.py.");
      }
      const report = await loadJson(artifactUrl(manifest.report_path));
      state.report = report;
      state.pages = report.pages || [];
      status.textContent = "";
      status.hidden = true;
      renderSummary(report);
      fillTypeFilter(state.pages);
      renderTable();
      applyDeepLink();
    } catch (error) {
      status.textContent = `Could not load report: ${error.message}`;
    }
  }

  function applyDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("path") || "";
    if (!raw) return;
    let wanted = raw;
    try {
      if (wanted.startsWith("http")) wanted = new URL(wanted).pathname;
    } catch {
      /* keep */
    }
    wanted = wanted.split("?")[0];
    if (wanted.length > 1) wanted = wanted.replace(/\/+$/, "");
    const index = state.pages.findIndex((page) => {
      const path = String(page.canonical_path || "").replace(/\/+$/, "") || "/";
      return path === wanted;
    });
    if (index >= 0) showPage(index);
  }

  if (!window.TATVIC_SHARED_THEME) {
    initTheme();
    $("theme-toggle")?.addEventListener("click", () => {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }
  $("search").addEventListener("input", renderTable);
  $("type-filter").addEventListener("change", renderTable);
  $("status-filter").addEventListener("change", renderTable);
  $("sort-filter").addEventListener("change", renderTable);
  $("clear-filters").addEventListener("click", clearFilters);
  $("clear-category").addEventListener("click", () => {
    $("type-filter").value = "";
    renderTable();
  });
  $("category-chart").addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    $("type-filter").value = $("type-filter").value === button.dataset.type ? "" : button.dataset.type;
    renderTable();
    $("pages-heading").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("pages-body").addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    const button = event.target.closest("[data-index]");
    if (!button) return;
    showPage(Number(button.dataset.index));
  });
  $("export-facts").addEventListener("click", exportFacts);
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  $("load-json").addEventListener("click", () => loadDeveloper("json"));
  $("load-html").addEventListener("click", () => loadDeveloper("html"));
  $("tab-screenshot").addEventListener("click", (event) => {
    const opener = event.target.closest(".shot-open");
    if (!opener) return;
    const dialog = $("shot-dialog");
    $("shot-dialog-img").src = opener.dataset.src;
    if (typeof dialog.showModal === "function") dialog.showModal();
  });

  init();
})();
