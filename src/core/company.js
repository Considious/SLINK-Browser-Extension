(function installCompanyCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Company.');
  const SCOPE = 'slink.qol.company';
  const CACHE_MS = 15 * 60_000;
  const DEFAULT_SETTINGS = Object.freeze({
    enabled:true,
    addictionThreshold:10,
    directorThreshold:10,
    refreshMinutes:15
  });

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = finite(value);
    return number === null ? fallback : Math.min(maximum, Math.max(minimum, number));
  }

  function normalizeSettings(value = {}) {
    return {
      enabled:value.enabled !== false,
      addictionThreshold:clamp(value.addictionThreshold, 1, 100, DEFAULT_SETTINGS.addictionThreshold),
      directorThreshold:clamp(value.directorThreshold, 1, 100, DEFAULT_SETTINGS.directorThreshold),
      refreshMinutes:clamp(value.refreshMinutes, 5, 60, DEFAULT_SETTINGS.refreshMinutes)
    };
  }

  function addictionPenalty(employee = {}) {
    const value = finite(employee?.effectiveness?.addiction);
    return value === null ? null : Math.abs(Math.min(0, value));
  }

  function normalizeEmployee(employee = {}) {
    const id = Math.trunc(Number(employee.id ?? employee.user_id ?? employee.userId) || 0);
    const effectiveness = employee.effectiveness && typeof employee.effectiveness === 'object'
      ? { ...employee.effectiveness }
      : null;
    const stats = employee.stats && typeof employee.stats === 'object' ? { ...employee.stats } : null;
    const workingStats = finite(effectiveness?.working_stats ?? effectiveness?.workingStats);
    const totalStats = stats ? Object.values(stats).reduce((sum, value) => sum + (finite(value) || 0), 0) : null;
    return {
      id,
      name:String(employee.name || employee.player_name || `User ${id || '?'}`),
      position:String(employee.position || employee.position_name || ''),
      daysInCompany:Math.max(0, Math.trunc(Number(employee.days_in_company ?? employee.daysInCompany) || 0)),
      lastAction:employee.last_action || employee.lastAction || null,
      effectiveness,
      stats,
      addictionPenalty:addictionPenalty(employee),
      totalEffectiveness:finite(effectiveness?.total),
      workingStatsEffectiveness:workingStats,
      trainHeadroom:workingStats === null ? null : Math.max(0, 50 - workingStats),
      totalStats
    };
  }

  function normalizeSnapshot(userResponse = {}, companyResponse = {}, userId = 0, fetchedAt = Date.now()) {
    const job = userResponse.job || userResponse;
    const jobpoints = userResponse.jobpoints || userResponse.job_points || {};
    const profile = companyResponse.profile || companyResponse.company || {};
    const employeeRows = Array.isArray(companyResponse.employees)
      ? companyResponse.employees
      : Object.values(companyResponse.employees || {});
    const employees = employeeRows.map(normalizeEmployee).filter(employee => employee.id > 0);
    const directorId = Math.trunc(Number(profile?.director?.id ?? profile?.director_id) || 0);
    const currentUserId = Math.trunc(Number(userId) || 0);
    const self = employees.find(employee => employee.id === currentUserId) || null;
    const companyId = Math.trunc(Number(job?.id ?? job?.company_id ?? job?.company?.id ?? profile?.id) || 0);
    const companyTypeId = Math.trunc(Number(job?.type_id ?? job?.company_type ?? job?.company?.type_id) || 0);
    const companyPoints = Array.isArray(jobpoints?.companies)
      ? jobpoints.companies.find(entry => Number(entry?.company?.id ?? entry?.company_type_id) === companyTypeId)
      : null;
    return {
      fetchedAt:Number(fetchedAt) || Date.now(),
      userId:currentUserId,
      company:{
        id:companyId,
        name:String(job?.company_name ?? job?.company?.name ?? profile?.name ?? ''),
        typeId:companyTypeId,
        rating:Math.trunc(Number(job?.company_rating ?? job?.rating ?? profile?.rating) || 0),
        position:String(job?.position ?? ''),
        daysInCompany:Math.max(0, Math.trunc(Number(job?.days_in_company) || 0)),
        jobPoints:finite(companyPoints?.points ?? jobpoints?.jobs?.points ?? jobpoints?.points)
      },
      director:directorId > 0 && directorId === currentUserId,
      directorId,
      self,
      employees
    };
  }

  function rankTrainCandidates(employees = []) {
    return [...employees]
      .filter(employee => finite(employee.trainHeadroom) !== null)
      .sort((left, right) =>
        Number(right.trainHeadroom) - Number(left.trainHeadroom)
        || (Number(left.totalStats ?? Number.MAX_SAFE_INTEGER) - Number(right.totalStats ?? Number.MAX_SAFE_INTEGER))
        || left.name.localeCompare(right.name)
      );
  }

  function reminderText(employee) {
    const penalty = addictionPenalty(employee);
    return `Your addiction penalty is currently ${penalty === null ? 'unknown' : '-' + penalty}. Please rehab as soon as possible.`;
  }

  function buildAlerts(snapshot, settingsValue = {}) {
    const settings = normalizeSettings(settingsValue);
    if (!settings.enabled || !snapshot) return [];
    const alerts = [];
    if (snapshot.self && snapshot.self.addictionPenalty !== null && snapshot.self.addictionPenalty >= settings.addictionThreshold) {
      alerts.push({
        id:'company:addiction:self',
        type:'companyAddiction',
        title:'Company addiction reminder',
        detail:`Your company effectiveness addiction penalty is -${snapshot.self.addictionPenalty}. Please rehab as soon as possible.`,
        links:[['Company','https://www.torn.com/joblist.php']]
      });
    }
    if (snapshot.director) {
      for (const employee of snapshot.employees || []) {
        if (employee.id === snapshot.userId || employee.addictionPenalty === null || employee.addictionPenalty < settings.directorThreshold) continue;
        alerts.push({
          id:`company:addiction:${employee.id}`,
          type:'companyEmployeeAddiction',
          title:`${employee.name} needs rehab`,
          detail:`Company effectiveness addiction penalty: -${employee.addictionPenalty}.`,
          links:[
            ['Profile',`https://www.torn.com/profiles.php?XID=${employee.id}`],
            ['Message',`https://www.torn.com/messages.php#/p=compose&XID=${employee.id}`]
          ],
          employeeId:employee.id,
          reminder:reminderText(employee)
        });
      }
    }
    return alerts;
  }

  SLINK.define('core', 'company', Object.freeze({
    SCOPE,
    CACHE_MS,
    DEFAULT_SETTINGS,
    addictionPenalty,
    buildAlerts,
    normalizeEmployee,
    normalizeSettings,
    normalizeSnapshot,
    rankTrainCandidates,
    reminderText
  }));
})(globalThis);
