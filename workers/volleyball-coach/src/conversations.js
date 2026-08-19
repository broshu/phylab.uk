// @ts-check

export const CONVERSATION_RETENTION_DAYS = 30;
export const CONVERSATION_PAGE_SIZE = 25;
export const PROMPT_VERSION = 'volleyball-coach-v3';

/**
 * @typedef {object} ConversationRecord
 * @property {string} id
 * @property {string} sessionId
 * @property {string} question
 * @property {string} reply
 * @property {string} mode
 * @property {string | null} model
 * @property {string} phase
 * @property {string} verdict
 * @property {number | null} speed
 * @property {number | null} heightAtNet
 * @property {number | null} netClearance
 * @property {number | null} xLand
 * @property {number | null} outBy
 * @property {number | null} attemptCount
 * @property {string} promptVersion
 * @property {number | null} inputTokens
 * @property {number | null} outputTokens
 * @property {number | null} totalTokens
 * @property {number} latencyMs
 */

/**
 * Store only the learner's anonymous session, question, answer, and physics
 * context. Request metadata such as IP address and User-Agent is intentionally
 * never accepted by this function.
 * @param {D1Database} db
 * @param {ConversationRecord} record
 */
export async function recordConversation(db, record) {
  const result = await db
    .prepare(
      'INSERT INTO coach_conversations (' +
        'id, session_id, question, reply, mode, model, phase, verdict, speed, ' +
        'height_at_net, net_clearance, x_land, out_by, attempt_count, ' +
        'prompt_version, input_tokens, output_tokens, total_tokens, latency_ms' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      record.id,
      record.sessionId,
      record.question,
      record.reply,
      record.mode,
      record.model,
      record.phase,
      record.verdict,
      record.speed,
      record.heightAtNet,
      record.netClearance,
      record.xLand,
      record.outBy,
      record.attemptCount,
      record.promptVersion,
      record.inputTokens,
      record.outputTokens,
      record.totalTokens,
      record.latencyMs,
    )
    .run();

  if (!result.success) {
    throw new Error('Conversation insert failed.');
  }

  try {
    await db
      .prepare(
        'DELETE FROM coach_conversations ' +
          `WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${CONVERSATION_RETENTION_DAYS} days')`,
      )
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'coach_retention_cleanup_error',
        error: error instanceof Error ? error.name : 'Unknown database error',
      }),
    );
  }
}

/**
 * @param {D1Database} db
 * @param {number} requestedPage
 */
export async function listConversations(db, requestedPage) {
  const page = Math.min(10_000, Math.max(1, Math.trunc(requestedPage) || 1));
  const offset = (page - 1) * CONVERSATION_PAGE_SIZE;

  const [countResult, rowsResult] = await db.batch([
    db.prepare('SELECT COUNT(*) AS total FROM coach_conversations'),
    db
      .prepare(
        'SELECT id, created_at AS createdAt, session_id AS sessionId, question, reply, ' +
          'mode, model, phase, verdict, speed, height_at_net AS heightAtNet, ' +
          'net_clearance AS netClearance, x_land AS xLand, out_by AS outBy, ' +
          'attempt_count AS attemptCount, prompt_version AS promptVersion, ' +
          'input_tokens AS inputTokens, output_tokens AS outputTokens, ' +
          'total_tokens AS totalTokens, latency_ms AS latencyMs ' +
          'FROM coach_conversations ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .bind(CONVERSATION_PAGE_SIZE, offset),
  ]);

  const countRow = /** @type {Record<string, unknown> | undefined} */ (countResult.results[0]);
  const countValue = countRow?.total;
  const total =
    typeof countValue === 'number' && Number.isFinite(countValue)
      ? countValue
      : 0;

  return {
    records: rowsResult.results,
    pagination: {
      page,
      pageSize: CONVERSATION_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / CONVERSATION_PAGE_SIZE)),
    },
    retentionDays: CONVERSATION_RETENTION_DAYS,
  };
}
