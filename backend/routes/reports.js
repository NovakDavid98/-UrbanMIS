import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// =================================================================================
// GET EXECUTIVE DASHBOARD STATS
// =================================================================================
router.get('/executive-dashboard', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = '';
    let dateParams = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      dateFilter = ` AND service_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      dateParams = [startDate, endDate];
      paramIndex += 2;
    }

    // Get total clients stats
    const clientStatsQuery = `
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN activity_status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN gender = 'Muž' THEN 1 END) as male_clients,
        COUNT(CASE WHEN gender = 'Žena' THEN 1 END) as female_clients,
        ROUND(AVG(age)) as avg_age
      FROM clients
      WHERE age > 0
    `;
    const clientStats = await query(clientStatsQuery);

    // Get service stats
    const serviceStatsQuery = `
      SELECT 
        COUNT(*) as total_services,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        ROUND(AVG(duration_minutes)) as avg_duration
      FROM service_records
      WHERE 1=1 ${dateFilter}
    `;
    const serviceStats = await query(serviceStatsQuery, dateParams);

    // Get services this month vs last month
    const servicesCompareQuery = `
      SELECT 
        COUNT(CASE WHEN service_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
        COUNT(CASE WHEN service_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
                    AND service_date < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
      FROM service_records
    `;
    const servicesCompare = await query(servicesCompareQuery);

    // Get worker stats
    const workerStatsQuery = `
      SELECT 
        COUNT(*) as total_workers,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_workers
      FROM users
    `;
    const workerStats = await query(workerStatsQuery);

    // Get contracts expiring soon
    const expiringContractsQuery = `
      SELECT COUNT(*) as expiring_soon
      FROM contracts
      WHERE is_active = true 
        AND end_date IS NOT NULL 
        AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    `;
    const expiringContracts = await query(expiringContractsQuery);

    // Get plans stats
    const plansStatsQuery = `
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_plans,
        ROUND(AVG(completion_percentage)) as avg_completion
      FROM individual_plans
    `;
    const plansStats = await query(plansStatsQuery);

    // Calculate trends
    const thisMonth = parseInt(servicesCompare.rows[0].this_month) || 0;
    const lastMonth = parseInt(servicesCompare.rows[0].last_month) || 0;
    const serviceTrend = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        clients: {
          total: parseInt(clientStats.rows[0].total_clients),
          active: parseInt(clientStats.rows[0].active_clients),
          male: parseInt(clientStats.rows[0].male_clients),
          female: parseInt(clientStats.rows[0].female_clients),
          avgAge: parseInt(clientStats.rows[0].avg_age) || 0
        },
        services: {
          total: parseInt(serviceStats.rows[0].total_services),
          thisMonth: thisMonth,
          lastMonth: lastMonth,
          trend: parseFloat(serviceTrend),
          totalHours: Math.round(parseInt(serviceStats.rows[0].total_minutes) / 60),
          avgDuration: parseInt(serviceStats.rows[0].avg_duration) || 0
        },
        workers: {
          total: parseInt(workerStats.rows[0].total_workers),
          active: parseInt(workerStats.rows[0].active_workers)
        },
        alerts: {
          expiringContracts: parseInt(expiringContracts.rows[0].expiring_soon)
        },
        plans: {
          total: parseInt(plansStats.rows[0].total_plans),
          active: parseInt(plansStats.rows[0].active_plans),
          avgCompletion: parseInt(plansStats.rows[0].avg_completion) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching executive dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// =================================================================================
// GET CLIENT DEMOGRAPHICS
// =================================================================================
router.get('/demographics', async (req, res) => {
  try {
    // Gender distribution (only Muž and Žena)
    const genderQuery = `
      SELECT 
        gender,
        COUNT(*) as count
      FROM clients
      WHERE gender IN ('Muž', 'Žena')
      GROUP BY gender
      ORDER BY count DESC
    `;
    const genderData = await query(genderQuery);

    // Age distribution (grouped)
    const ageQuery = `
      SELECT 
        age_group,
        COUNT(*) as count
      FROM (
        SELECT 
          CASE 
            WHEN age < 18 THEN '0-17'
            WHEN age BETWEEN 18 AND 30 THEN '18-30'
            WHEN age BETWEEN 31 AND 50 THEN '31-50'
            WHEN age BETWEEN 51 AND 70 THEN '51-70'
            ELSE '70+'
          END as age_group,
          CASE 
            WHEN age < 18 THEN 1
            WHEN age BETWEEN 18 AND 30 THEN 2
            WHEN age BETWEEN 31 AND 50 THEN 3
            WHEN age BETWEEN 51 AND 70 THEN 4
            ELSE 5
          END as sort_order
        FROM clients
        WHERE age > 0
      ) subquery
      GROUP BY age_group, sort_order
      ORDER BY sort_order
    `;
    const ageData = await query(ageQuery);

    // Insurance distribution
    const insuranceQuery = `
      SELECT 
        COALESCE(insurance_company, 'Bez pojištění') as insurance,
        COUNT(*) as count
      FROM clients
      GROUP BY insurance_company
      ORDER BY count DESC
      LIMIT 10
    `;
    const insuranceData = await query(insuranceQuery);

    // Top Ukrainian regions
    const regionsQuery = `
      SELECT 
        ukrainian_region as region,
        COUNT(*) as count
      FROM clients
      WHERE ukrainian_region IS NOT NULL 
        AND ukrainian_region != ''
        AND ukrainian_region NOT LIKE '%:%'
        AND ukrainian_region NOT LIKE 'email%'
        AND ukrainian_region NOT LIKE 'mult%'
        AND ukrainian_region NOT LIKE 'insurance%'
      GROUP BY ukrainian_region
      ORDER BY count DESC
      LIMIT 15
    `;
    const regionsData = await query(regionsQuery);

    res.json({
      success: true,
      data: {
        // Convert counts to numbers (PostgreSQL bigint comes as string)
        gender: genderData.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        })),
        ageGroups: ageData.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        })),
        insurance: insuranceData.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        })),
        regions: regionsData.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching demographics:', error);
    res.status(500).json({ error: 'Failed to fetch demographics' });
  }
});

// =================================================================================
// GET CLIENT TIMELINE (Arrival + Cumulative Growth)
// =================================================================================
router.get('/client-timeline', async (req, res) => {
  try {
    // Client arrival timeline - when did refugees arrive in Czech Republic
    const arrivalTimelineQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', date_of_arrival_czech), 'YYYY-MM') as period,
        COUNT(*) as count
      FROM clients
      WHERE date_of_arrival_czech IS NOT NULL
        AND date_of_arrival_czech >= '2022-01-01'
      GROUP BY DATE_TRUNC('month', date_of_arrival_czech)
      ORDER BY period ASC
    `;
    const arrivalTimeline = await query(arrivalTimelineQuery);

    // Cumulative client growth - running total of clients served over time
    // Uses first visit date as "served date" for each client
    const cumulativeGrowthQuery = `
      WITH client_first_contact AS (
        SELECT 
          c.id as client_id,
          LEAST(
            COALESCE(MIN(v.visit_date), c.created_at::date),
            COALESCE(MIN(sr.service_date), c.created_at::date)
          ) as first_contact_date
        FROM clients c
        LEFT JOIN visits v ON c.id = v.client_id
        LEFT JOIN service_records sr ON c.id = sr.client_id
        GROUP BY c.id, c.created_at
      ),
      monthly_new_clients AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('month', first_contact_date), 'YYYY-MM') as period,
          COUNT(*) as new_clients
        FROM client_first_contact
        WHERE first_contact_date >= '2022-01-01'
        GROUP BY DATE_TRUNC('month', first_contact_date)
        ORDER BY period ASC
      )
      SELECT 
        period,
        new_clients,
        SUM(new_clients) OVER (ORDER BY period) as cumulative_total
      FROM monthly_new_clients
      ORDER BY period ASC
    `;
    const cumulativeGrowth = await query(cumulativeGrowthQuery);

    res.json({
      success: true,
      data: {
        arrivalTimeline: arrivalTimeline.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        })),
        cumulativeGrowth: cumulativeGrowth.rows.map(row => ({
          ...row,
          new_clients: parseInt(row.new_clients) || 0,
          cumulative_total: parseInt(row.cumulative_total) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching client timeline:', error);
    res.status(500).json({ error: 'Failed to fetch client timeline' });
  }
});

// =================================================================================
// GET SERVICE ANALYTICS
// =================================================================================
router.get('/services-analytics', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'month' } = req.query;

    // Build date filter
    let dateFilter = '';
    let dateParams = [];

    if (startDate && endDate) {
      dateFilter = ` AND service_date BETWEEN $1 AND $2`;
      dateParams = [startDate, endDate];
    }

    // Services over time
    let timeGrouping;
    switch (groupBy) {
      case 'day':
        timeGrouping = "TO_CHAR(service_date, 'YYYY-MM-DD')";
        break;
      case 'week':
        timeGrouping = "TO_CHAR(DATE_TRUNC('week', service_date), 'YYYY-MM-DD')";
        break;
      case 'month':
      default:
        timeGrouping = "TO_CHAR(service_date, 'YYYY-MM')";
        break;
    }

    // Exclude current incomplete month for monthly view to avoid misleading downward trajectory
    let currentPeriodFilter = '';
    if (groupBy === 'month') {
      currentPeriodFilter = ` AND service_date < DATE_TRUNC('month', CURRENT_DATE)`;
    }

    const servicesOverTimeQuery = `
      SELECT 
        ${timeGrouping} as period,
        COUNT(*) as count,
        COALESCE(SUM(duration_minutes), 0) as total_minutes
      FROM service_records
      WHERE 1=1 ${dateFilter}${currentPeriodFilter}
      GROUP BY ${timeGrouping}
      ORDER BY period DESC
      LIMIT 12
    `;
    const servicesOverTime = await query(servicesOverTimeQuery, dateParams);

    // Services by type
    const servicesByTypeQuery = `
      SELECT 
        service_type as type,
        COUNT(*) as count,
        ROUND(AVG(duration_minutes)) as avg_duration
      FROM service_records
      WHERE service_type IS NOT NULL ${dateFilter}
      GROUP BY service_type
      ORDER BY count DESC
      LIMIT 10
    `;
    const servicesByType = await query(servicesByTypeQuery, dateParams);

    // Services by location (merge streetwork and Terénní práce)
    const servicesByLocationQuery = `
      SELECT 
        CASE 
          WHEN LOWER(location) IN ('streetwork', 'terénní práce') THEN 'Terénní práce'
          ELSE COALESCE(location, 'Nespecifikováno')
        END as location,
        COUNT(*) as count
      FROM service_records
      WHERE 1=1 ${dateFilter}
      GROUP BY CASE 
        WHEN LOWER(location) IN ('streetwork', 'terénní práce') THEN 'Terénní práce'
        ELSE COALESCE(location, 'Nespecifikováno')
      END
      ORDER BY count DESC
      LIMIT 10
    `;
    const servicesByLocation = await query(servicesByLocationQuery, dateParams);

    // Services by topic
    const servicesByTopicQuery = `
      SELECT 
        COALESCE(topic, 'Nespecifikováno') as topic,
        COUNT(*) as count
      FROM service_records
      WHERE 1=1 ${dateFilter}
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 10
    `;
    const servicesByTopic = await query(servicesByTopicQuery, dateParams);

    // Worker performance (excludes system accounts)
    const workerPerformanceQuery = `
      SELECT 
        u.first_name || ' ' || u.last_name as worker_name,
        (COUNT(sr.id) + COUNT(v.id)) as service_count,
        COALESCE(SUM(sr.duration_minutes), 0) as total_minutes
      FROM users u
      LEFT JOIN service_records sr ON u.id = sr.created_by ${dateFilter ? 'AND sr.service_date BETWEEN $1 AND $2' : ''}
      LEFT JOIN visits v ON u.id = v.created_by ${dateFilter ? 'AND v.visit_date BETWEEN $1 AND $2' : ''}
      WHERE LOWER(u.first_name || ' ' || u.last_name) NOT IN ('david novak', 'system import', 'david novák')
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY service_count DESC
      LIMIT 10
    `;
    const workerPerformance = await query(workerPerformanceQuery, dateParams);

    res.json({
      success: true,
      data: {
        // Convert counts to numbers (PostgreSQL bigint comes as string)
        overTime: servicesOverTime.rows.reverse().map(row => ({
          ...row,
          count: parseInt(row.count) || 0,
          total_minutes: parseInt(row.total_minutes) || 0
        })),
        byType: servicesByType.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0,
          avg_duration: parseInt(row.avg_duration) || 0
        })),
        byLocation: servicesByLocation.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        })),
        byTopic: servicesByTopic.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        })),
        workerPerformance: workerPerformance.rows.map(row => ({
          ...row,
          service_count: parseInt(row.service_count) || 0,
          total_minutes: parseInt(row.total_minutes) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching service analytics:', error);
    res.status(500).json({ error: 'Failed to fetch service analytics' });
  }
});

// =================================================================================
// GET ALERTS & PRIORITIES
// =================================================================================
router.get('/alerts', async (req, res) => {
  try {
    // Contracts expiring soon
    const expiringContractsQuery = `
      SELECT 
        c.id,
        c.title,
        c.end_date,
        cl.first_name || ' ' || cl.last_name as client_name,
        cl.id as client_id,
        (c.end_date - CURRENT_DATE) as days_until_expiry
      FROM contracts c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.is_active = true 
        AND c.end_date IS NOT NULL 
        AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY c.end_date ASC
      LIMIT 10
    `;
    const expiringContracts = await query(expiringContractsQuery);

    // Clients with no recent service (>30 days)
    const inactiveClientsQuery = `
      SELECT 
        c.id,
        c.first_name || ' ' || c.last_name as client_name,
        MAX(sr.service_date) as last_service_date,
        (CURRENT_DATE - MAX(sr.service_date)) as days_since_service
      FROM clients c
      LEFT JOIN service_records sr ON c.id = sr.client_id
      WHERE c.activity_status = 'active'
      GROUP BY c.id, c.first_name, c.last_name
      HAVING MAX(sr.service_date) < CURRENT_DATE - INTERVAL '30 days'
        OR MAX(sr.service_date) IS NULL
      ORDER BY days_since_service DESC NULLS FIRST
      LIMIT 10
    `;
    const inactiveClients = await query(inactiveClientsQuery);

    // Plans with low completion rate
    const strugglingPlansQuery = `
      SELECT 
        ip.id,
        ip.title,
        ip.completion_percentage,
        cl.first_name || ' ' || cl.last_name as client_name,
        cl.id as client_id,
        (CURRENT_DATE - ip.start_date) as days_active
      FROM individual_plans ip
      JOIN clients cl ON ip.client_id = cl.id
      WHERE ip.is_active = true 
        AND ip.completion_percentage < 50
        AND ip.start_date < CURRENT_DATE - INTERVAL '30 days'
      ORDER BY ip.completion_percentage ASC
      LIMIT 10
    `;
    const strugglingPlans = await query(strugglingPlansQuery);

    // Data quality issues
    const dataQualityQuery = `
      SELECT 
        COUNT(CASE WHEN insurance_company IS NULL OR insurance_company = '' THEN 1 END) as missing_insurance,
        COUNT(CASE WHEN visa_type IS NULL OR visa_type = '' THEN 1 END) as missing_visa,
        COUNT(CASE WHEN ukrainian_region IS NULL OR ukrainian_region = '' THEN 1 END) as missing_region,
        COUNT(CASE WHEN age < 0 OR age IS NULL THEN 1 END) as missing_age,
        COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as missing_email
      FROM clients
      WHERE activity_status = 'active'
    `;
    const dataQuality = await query(dataQualityQuery);

    res.json({
      success: true,
      data: {
        expiringContracts: expiringContracts.rows,
        inactiveClients: inactiveClients.rows,
        strugglingPlans: strugglingPlans.rows,
        dataQuality: dataQuality.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// =================================================================================
// GET CLIENT ENGAGEMENT METRICS
// =================================================================================
router.get('/engagement', async (req, res) => {
  try {
    // Services per client distribution (combines service_records + visits) - excludes clients with 0
    const servicesPerClientQuery = `
      SELECT 
        range,
        COUNT(*) as client_count
      FROM (
        SELECT 
          c.id,
          (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) as total_services,
          CASE 
            WHEN (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) BETWEEN 1 AND 5 THEN '1-5'
            WHEN (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) BETWEEN 6 AND 10 THEN '6-10'
            WHEN (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) BETWEEN 11 AND 20 THEN '11-20'
            ELSE '20+'
          END as range,
          CASE 
            WHEN (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) BETWEEN 1 AND 5 THEN 1
            WHEN (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) BETWEEN 6 AND 10 THEN 2
            WHEN (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) BETWEEN 11 AND 20 THEN 3
            ELSE 4
          END as sort_order
        FROM clients c
        LEFT JOIN service_records sr ON c.id = sr.client_id
        LEFT JOIN visits v ON c.id = v.client_id
        GROUP BY c.id
        HAVING (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) > 0
      ) subquery
      GROUP BY range, sort_order
      ORDER BY sort_order
    `;
    const servicesPerClient = await query(servicesPerClientQuery);

    // Most engaged clients
    const mostEngagedQuery = `
      SELECT 
        c.first_name || ' ' || c.last_name as client_name,
        c.id as client_id,
        (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) as service_count,
        GREATEST(MAX(sr.service_date), MAX(v.visit_date)) as last_service_date
      FROM clients c
      LEFT JOIN service_records sr ON c.id = sr.client_id
      LEFT JOIN visits v ON c.id = v.client_id
      GROUP BY c.id, c.first_name, c.last_name
      HAVING (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) > 0
      ORDER BY service_count DESC
      LIMIT 10
    `;
    const mostEngaged = await query(mostEngagedQuery);

    // Client arrival timeline
    const arrivalTimelineQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', date_of_arrival_czech), 'YYYY-MM') as month,
        COUNT(*) as count
      FROM clients
      WHERE date_of_arrival_czech IS NOT NULL
        AND date_of_arrival_czech >= '2022-01-01'
      GROUP BY DATE_TRUNC('month', date_of_arrival_czech)
      ORDER BY month ASC
    `;
    const arrivalTimeline = await query(arrivalTimelineQuery);

    res.json({
      success: true,
      data: {
        // Convert counts to numbers (PostgreSQL bigint comes as string)
        servicesPerClient: servicesPerClient.rows.map(row => ({
          ...row,
          client_count: parseInt(row.client_count) || 0
        })),
        mostEngaged: mostEngaged.rows.map(row => ({
          ...row,
          service_count: parseInt(row.service_count) || 0
        })),
        arrivalTimeline: arrivalTimeline.rows.map(row => ({
          ...row,
          count: parseInt(row.count) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching engagement metrics:', error);
    res.status(500).json({ error: 'Failed to fetch engagement metrics' });
  }
});

export default router;
