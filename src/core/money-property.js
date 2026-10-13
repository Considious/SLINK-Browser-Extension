(function installMoneyPropertyCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Money & Property.');

  const SCOPE = 'slink.qol.money-property';
  const CACHE_MS = 15 * 60_000;
  const CATALOG_MS = 7 * 86_400_000;
  const STOCKS_URL = 'https://www.torn.com/page.php?sid=stocks';
  const PROPERTY_URL = 'https://www.torn.com/properties.php';
  const BANK_URL = 'https://www.torn.com/city.php#/p=bank';
  const LOAN_URL = 'https://www.torn.com/loan.php';

  function finite(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function integer(value) {
    const parsed = finite(value);
    return parsed === null ? 0 : Math.max(0, Math.trunc(parsed));
  }

  function timestampMs(value) {
    const parsed = finite(value);
    if (parsed === null || parsed <= 0) return 0;
    return parsed < 10_000_000_000 ? Math.trunc(parsed * 1000) : Math.trunc(parsed);
  }

  function rows(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  }

  function firstFinite(...values) {
    for (const value of values) {
      const parsed = finite(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  function textAmount(value) {
    const text = String(value || '').replace(/,/g, '');
    const match = text.match(/\$?([\d.]+)\s*([kmbt])?/i);
    if (!match) return 0;
    const scale = { k:1e3, m:1e6, b:1e9, t:1e12 }[String(match[2] || '').toLowerCase()] || 1;
    return Math.max(0, Number(match[1]) * scale) || 0;
  }

  function daysFromFrequency(value, description = '') {
    const parsed = finite(value);
    if (parsed !== null && parsed > 0) return parsed > 366 ? parsed / 86_400 : parsed;
    const text = String(description || '').toLowerCase();
    const match = text.match(/every\s+(\d+(?:\.\d+)?)\s*(day|week|month|year)/);
    if (match) return Number(match[1]) * ({ day:1, week:7, month:30.4375, year:365 }[match[2]] || 1);
    if (/daily|each day/.test(text)) return 1;
    if (/weekly|each week/.test(text)) return 7;
    if (/monthly|each month/.test(text)) return 30.4375;
    return 0;
  }

  function normalizeSettings(value = {}) {
    const stockAlerts = value.stockAlerts && typeof value.stockAlerts === 'object' ? { ...value.stockAlerts } : {};
    return {
      enabled:value.enabled !== false,
      bankLeadHours:Math.min(168, Math.max(0, Number(value.bankLeadHours) || 2)),
      rentalLeadDays:Math.min(30, Math.max(0, Number(value.rentalLeadDays) || 3)),
      cashierLeadHours:Math.min(168, Math.max(0, Number(value.cashierLeadHours) || 24)),
      upkeepThreshold:Math.max(0, Math.trunc(Number(value.upkeepThreshold) || 1_000_000)),
      loanReminder:value.loanReminder !== false,
      soundEnabled:value.soundEnabled === true,
      stockAlerts
    };
  }

  function normalizeBank(money = {}, now = Date.now()) {
    const raw = money.city_bank || money.cityBank || money.bank || {};
    const amount = integer(raw.amount ?? raw.invested ?? raw.balance);
    const timeLeft = firstFinite(raw.time_left, raw.timeLeft, raw.seconds_remaining, raw.remaining);
    const maturedAt = timestampMs(raw.matures_at ?? raw.maturity ?? raw.end_time ?? raw.ends_at)
      || (timeLeft !== null ? now + Math.max(0, timeLeft) * 1000 : 0);
    return {
      amount,
      interest:integer(raw.interest ?? raw.profit ?? raw.return_amount),
      timeLeft:timeLeft === null ? null : Math.max(0, timeLeft),
      maturedAt,
      matured:amount > 0 && ((timeLeft !== null && timeLeft <= 0) || (maturedAt > 0 && maturedAt <= now))
    };
  }

  function normalizeChecks(money = {}, now = Date.now()) {
    const source = money.cashier_checks || money.cashiers_checks || money.cashierChecks || money.checks || [];
    return rows(source).map((entry, index) => {
      const expiresAt = timestampMs(entry?.expires_at ?? entry?.expiration ?? entry?.valid_until ?? entry?.end_time);
      return {
        id:String(entry?.id ?? index),
        amount:integer(entry?.amount ?? entry?.value),
        expiresAt,
        expired:expiresAt > 0 && expiresAt <= now
      };
    }).filter(entry => entry.amount > 0 || entry.expiresAt > 0);
  }

  function normalizeProperties(payload = {}, now = Date.now()) {
    const source = payload.properties ?? payload;
    return rows(source).map((entry, index) => {
      const rental = entry?.rental || entry?.rented || {};
      const lease = entry?.lease_extension ?? entry?.leaseExtension ?? null;
      const daysLeft = firstFinite(rental?.days_left, rental?.daysLeft, entry?.days_left);
      const rentalEndsAt = timestampMs(rental?.expires_at ?? rental?.end_date ?? rental?.until ?? entry?.rental_ends_at)
        || (daysLeft !== null ? now + Math.max(0, daysLeft) * 86_400_000 : 0);
      const leaseStatus = String(lease?.status || '').toLowerCase();
      return {
        id:integer(entry?.id ?? entry?.property_id) || index + 1,
        name:String(entry?.property?.name ?? entry?.name ?? entry?.property ?? 'Property'),
        status:String(entry?.status || ''),
        current:entry?.current === true || entry?.active === true || /rented|occupied/i.test(String(entry?.status || '')),
        rentalEndsAt,
        rentalDaysLeft:daysLeft,
        upkeepPerDay:integer(entry?.upkeep ?? entry?.upkeep_per_day),
        upkeepOwed:integer(entry?.upkeep_owed ?? entry?.upkeep_due ?? entry?.owed?.upkeep),
        leaseExtension:lease && typeof lease === 'object' ? {
          status:leaseStatus || 'pending',
          cost:integer(lease.cost),
          period:integer(lease.period),
          createdAt:timestampMs(lease.created_at)
        } : null
      };
    });
  }

  function achievementNames(user = {}) {
    const values = [
      ...rows(user.honors),
      ...rows(user.medals),
      ...rows(user.merits),
      ...rows(user.achievements)
    ];
    return values.map(entry => String(entry?.name ?? entry?.title ?? entry?.description ?? '')).filter(Boolean);
  }

  function normalizeLoan(money = {}) {
    const raw = money.duke_loan ?? money.dukeLoan ?? money.loan ?? money.duke ?? {};
    if (typeof raw === 'number') return { amount:integer(raw), dueAt:0 };
    return {
      amount:integer(raw?.amount ?? raw?.balance ?? raw?.owed ?? raw?.debt),
      dueAt:timestampMs(raw?.due_at ?? raw?.expires_at ?? raw?.end_time)
    };
  }

  function catalogStocks(payload = {}) {
    const source = payload.stocks ?? payload;
    return rows(source).map(entry => ({
      ...entry,
      id:integer(entry?.id ?? entry?.stock_id),
      name:String(entry?.name || entry?.acronym || ''),
      acronym:String(entry?.acronym || ''),
      price:Math.max(0, firstFinite(entry?.current_price, entry?.currentPrice, entry?.price) || 0)
    })).filter(entry => entry.id > 0);
  }

  function ownedStocks(payload = {}) {
    const source = payload.stocks ?? payload;
    return new Map(rows(source).map(entry => [
      integer(entry?.id ?? entry?.stock_id),
      integer(entry?.shares ?? entry?.total_shares ?? entry?.amount)
    ]).filter(([id]) => id > 0));
  }

  function benefitDefinitions(stock = {}) {
    const array = stock.benefits || stock.bonus?.tiers || stock.benefit?.tiers;
    if (Array.isArray(array) && array.length) return array.map(entry => ({ ...entry, repeatable:false }));
    const single = stock.bonus || stock.benefit;
    return single && typeof single === 'object' ? [{ ...single, repeatable:true }] : [];
  }

  function benefitEstimate(benefit = {}, itemCatalog = []) {
    const description = String(benefit.description || benefit.name || '');
    const direct = firstFinite(benefit.value, benefit.cash, benefit.payout, benefit.reward?.value);
    if (direct !== null && direct > 0) return direct;
    const cashMatch = description.match(/\$[\d,.]+\s*[kmbt]?/i);
    if (cashMatch) return textAmount(cashMatch[0]);
    const item = benefit.item || benefit.reward?.item || null;
    const itemId = integer(item?.id ?? benefit.item_id);
    const itemName = String(item?.name ?? benefit.item_name ?? '');
    const quantity = Math.max(1, integer(item?.amount ?? benefit.quantity ?? benefit.amount) || 1);
    const catalog = rows(itemCatalog);
    const match = catalog.find(row => (itemId && integer(row?.id) === itemId)
      || (itemName && String(row?.name || '').toLowerCase() === itemName.toLowerCase()));
    return quantity * Math.max(0, firstFinite(match?.marketPrice, match?.market_value, match?.marketValue) || 0);
  }

  function stockRows(userStocks, tornStocks, itemCatalog = [], availableCash = 0) {
    const owned = ownedStocks(userStocks);
    return catalogStocks(tornStocks).flatMap(stock => {
      const definitions = benefitDefinitions(stock);
      if (!definitions.length || !stock.price) return [];
      const sharesOwned = owned.get(stock.id) || 0;
      const tiers = definitions.map((benefit, index) => {
        const requirement = integer(benefit.requirement ?? benefit.shares_required ?? benefit.shares ?? benefit.minimum_shares);
        return { benefit, requirement, index };
      }).filter(entry => entry.requirement > 0).sort((a,b) => a.requirement - b.requirement);
      if (!tiers.length) return [];
      let next = tiers.find(entry => entry.requirement > sharesOwned);
      let threshold;
      if (next) threshold = next.requirement;
      else {
        const base = tiers[tiers.length - 1];
        if (!base.benefit.repeatable) return [];
        threshold = base.requirement * (Math.floor(sharesOwned / base.requirement) + 1);
        next = base;
      }
      const sharesNeeded = Math.max(0, threshold - sharesOwned);
      const incrementalCost = Math.ceil(sharesNeeded * stock.price);
      const blockCost = Math.ceil(threshold * stock.price);
      const benefitValue = benefitEstimate(next.benefit, itemCatalog);
      const periodDays = daysFromFrequency(next.benefit.frequency ?? next.benefit.interval, next.benefit.description);
      const weeklyValue = benefitValue > 0 && periodDays > 0 ? benefitValue * 7 / periodDays : 0;
      const monthlyValue = benefitValue > 0 && periodDays > 0 ? benefitValue * 30.4375 / periodDays : 0;
      return [{
        id:stock.id,
        name:stock.name,
        acronym:stock.acronym,
        price:stock.price,
        sharesOwned,
        nextThreshold:threshold,
        sharesNeeded,
        incrementalCost,
        blockCost,
        affordable:incrementalCost > 0 && availableCash >= incrementalCost,
        benefitDescription:String(next.benefit.description || next.benefit.name || 'Benefit value unavailable'),
        weeklyValue,
        monthlyValue,
        weeklyRoi:blockCost > 0 ? weeklyValue / blockCost : 0,
        monthlyRoi:blockCost > 0 ? monthlyValue / blockCost : 0,
        alertKey:`${stock.id}:${threshold}`
      }];
    }).sort((a,b) => b.monthlyRoi - a.monthlyRoi || a.incrementalCost - b.incrementalCost);
  }

  function buildStatus(input = {}, settingsInput = {}, now = Date.now()) {
    const user = input.user || {};
    const money = user.money || user;
    const cashOnHand = integer(money.cash ?? money.money_onhand ?? money.moneyOnHand);
    const factionCash = integer(money.faction?.money ?? money.faction_money ?? money.armory?.money);
    const vaultCash = integer(money.vault?.amount ?? money.vault);
    const availableCash = cashOnHand + factionCash;
    const names = achievementNames(user);
    const achievementsKnown = names.length > 0;
    const properties = normalizeProperties(user.properties || input.properties || {}, now);
    return {
      at:now,
      money:{ cashOnHand, factionCash, vaultCash, availableCash },
      bank:normalizeBank(money, now),
      cashierChecks:normalizeChecks(money, now),
      properties,
      currentProperty:properties.find(entry => entry.current) || properties[0] || null,
      loan:normalizeLoan(money),
      loanSharkEarned:achievementsKnown ? names.some(name => /loan shark/i.test(name)) : null,
      stocks:stockRows(user.stocks || {}, input.tornStocks || {}, input.itemCatalog || [], availableCash),
      settings:normalizeSettings(settingsInput)
    };
  }

  function buildAlerts(status = {}, settingsInput = {}, now = Date.now()) {
    const settings = normalizeSettings(settingsInput);
    if (!settings.enabled) return [];
    const alerts = [];
    const push = (id, title, detail, links) => alerts.push({ id:`money-property:${id}`, title, detail, links });
    const bank = status.bank || {};
    if (bank.matured) push('bank-matured', 'Bank investment is ready', 'Your completed bank investment is still waiting to be collected.', [['Bank',BANK_URL]]);
    else if (bank.amount > 0 && bank.maturedAt > now && bank.maturedAt - now <= settings.bankLeadHours * 3_600_000) {
      push('bank-soon', 'Bank investment matures soon', 'Your bank investment is approaching maturity.', [['Bank',BANK_URL]]);
    }
    for (const check of status.cashierChecks || []) {
      if (!check.expiresAt) continue;
      const remaining = check.expiresAt - now;
      if (remaining <= settings.cashierLeadHours * 3_600_000) {
        push(`cashier:${check.id}`, check.expired ? 'Cashier check expired' : 'Cashier check expires soon', `${check.amount ? '$' + check.amount.toLocaleString() + ' · ' : ''}${check.expired ? 'Review it now.' : 'Collect or use it before it expires.'}`, [['Items','https://www.torn.com/item.php']]);
      }
    }
    const property = status.currentProperty;
    if (property?.rentalEndsAt && property.rentalEndsAt - now <= settings.rentalLeadDays * 86_400_000) {
      push('rental', property.rentalEndsAt <= now ? 'Property rental expired' : 'Property rental expires soon', property.name, [['Property',PROPERTY_URL]]);
    }
    if (property?.upkeepOwed >= settings.upkeepThreshold && settings.upkeepThreshold > 0) {
      push('upkeep', 'Property upkeep needs attention', `$ ${property.upkeepOwed.toLocaleString()} is currently owed.`.replace('$ ', '$'), [['Property',PROPERTY_URL]]);
    }
    if (property?.leaseExtension && !['accepted','declined'].includes(property.leaseExtension.status)) {
      push('lease-extension', 'Rental extension offer waiting', `${property.name} has a pending lease-extension offer.`, [['Property',PROPERTY_URL]]);
    }
    if (status.loan?.amount > 0) {
      push('duke-loan', 'Duke loan is outstanding', `$ ${status.loan.amount.toLocaleString()} is currently owed.`.replace('$ ', '$'), [['Duke',LOAN_URL]]);
    } else if (settings.loanReminder && status.loanSharkEarned === false) {
      push('loan-shark', 'Loan Shark merit is still available', 'You have no Duke loan and have not earned Loan Shark yet.', [['Duke',LOAN_URL]]);
    }
    for (const stock of status.stocks || []) {
      if (settings.stockAlerts[stock.alertKey] !== true || !stock.affordable) continue;
      push(`stock:${stock.alertKey}`, `${stock.acronym || stock.name} next benefit is affordable`, `You have enough cash on hand plus faction armory cash to buy ${stock.sharesNeeded.toLocaleString()} additional shares.`, [['Stocks',STOCKS_URL]]);
    }
    return alerts;
  }

  SLINK.define('core', 'moneyProperty', Object.freeze({
    SCOPE,
    CACHE_MS,
    CATALOG_MS,
    BANK_URL,
    LOAN_URL,
    PROPERTY_URL,
    STOCKS_URL,
    buildAlerts,
    buildStatus,
    catalogStocks,
    normalizeBank,
    normalizeChecks,
    normalizeProperties,
    normalizeSettings,
    stockRows,
    timestampMs
  }));
})(globalThis);
