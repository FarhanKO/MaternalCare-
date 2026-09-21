/**
 * API routes — JSON interface consumed by the React client (frontend/).
 * routes → controllers → models; the guard below applies to every route.
 */
const express = require('express');
const router = express.Router();

const symptomApi = require('../controllers/api/symptomApiController');
const reminderApi = require('../controllers/api/reminderApiController');
const patientApi = require('../controllers/api/patientApiController');
const careApi = require('../controllers/api/careApiController');
const messageApi = require('../controllers/api/messageApiController');
const documentApi = require('../controllers/api/documentApiController');
const sosApi = require('../controllers/api/sosApiController');
const guardianApi = require('../controllers/api/guardianApiController');
const communityApi = require('../controllers/api/communityApiController');
const accountApi = require('../controllers/api/accountApiController');
const profileApi = require('../controllers/api/profileApiController');
const childApi = require('../controllers/api/childApiController');
const sessionApi = require('../controllers/api/sessionApiController');
const vitalApi = require('../controllers/api/vitalApiController');
const networkApi = require('../controllers/api/networkApiController');
const reportApi = require('../controllers/api/reportApiController');
const guidanceApi = require('../controllers/api/guidanceApiController');
const voiceApi = require('../controllers/api/voiceApiController');
const moderationApi = require('../controllers/api/moderationApiController');
const careEndingApi = require('../controllers/api/careEndingApiController');
const riskApi = require('../controllers/api/riskApiController');
const authApi = require('../controllers/api/authApiController');
const pushApi = require('../controllers/api/pushApiController');
const session = require('../middleware/session');
const rateLimit = require('../middleware/rateLimit');

/*
 * Everything below this line needs a signed-in account.
 *
 * Listed as exceptions rather than applied route by route, because the
 * failure mode of the other arrangement is silent: a new endpoint added
 * without its guard serves patient records to anybody, and nothing complains.
 * This way a new route is protected by default and has to be argued out of it.
 *
 * The exceptions:
 *   /auth/*      you cannot sign in while signed in
 *   /guardian/*  carries its own capability token, held by a family member
 *                who has no account here
 *   /community/images  <img> tags cannot send credentials in every context,
 *                and these are already unguessable UUID filenames
 *   /doctors/register  a clinician signing up has no account yet
 *
 * /network used to be here too. It lists this machine's private addresses
 * and interface names for the guardian pairing link — which only a signed-in
 * mother builds, so there was never a caller that needed it without a
 * session, and nothing else should learn the LAN layout from it.
 */
const PUBLIC = [/^\/auth\//, /^\/guardian\//, /^\/community\/images\//, /^\/doctors\/register$/];

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (PUBLIC.some((rx) => rx.test(req.path))) return next();
  return session.requireUser(req, res, next);
});

/* the signed-in user + her pregnancy summary */
router.get('/me', sessionApi.show);

/* update the signed-in user's life stage (set at the end of onboarding) */
router.patch('/me', sessionApi.setStage);
router.get('/me/language', sessionApi.language);

/* ------------------------------------------------------------ auth */
/* the routes that check a password are the routes worth guessing at, so
   they are the ones that count attempts — see middleware/rateLimit */
router.post('/auth/login', rateLimit.login, authApi.login);
router.post('/auth/logout', authApi.logout);
router.get('/auth/session', authApi.session);
router.post('/auth/register', rateLimit.register, authApi.register);
router.post('/auth/password', session.requireUser, rateLimit.password, authApi.changePassword);
/* where this account is signed in, and ending sessions that are not this one */
router.get('/auth/sessions', session.requireUser, authApi.sessions);
router.delete('/auth/sessions', session.requireUser, authApi.revokeOtherSessions);
router.delete('/auth/sessions/:id', session.requireUser, authApi.revokeSession);
/* names and emails for the sign-in screen; never the passwords */
router.get('/auth/demo-accounts', authApi.demoAccounts);
router.patch('/me/language', sessionApi.setLanguage);

/* patients — the clinician's caseload */
router.get('/patients', session.requireRole('clinician'), patientApi.index);
/* practice analytics, counted from her own caseload */
router.get('/analytics', session.requireRole('clinician'), patientApi.analytics);
router.get('/patients/:id', session.requireRole('clinician'), patientApi.show);
router.get('/patients/:id/reminders', session.requireRole('clinician'), patientApi.reminders);
router.get('/patients/:id/symptoms', session.requireRole('clinician'), patientApi.symptoms);
router.post('/patients/:id/reminders', session.requireRole('clinician'), patientApi.assign);
router.get('/patients/:id/guidance', session.requireRole('clinician'), guidanceApi.forPatient);

/* the personalised nutrition, movement and lifestyle plan */
router.get('/guidance', guidanceApi.mine);

/* F13: the rule engine and the FastAPI classifier, side by side */
router.get('/risk', riskApi.mine);
router.post('/risk/simulate', riskApi.simulate);
router.get('/risk/model', riskApi.modelCard);
router.get('/patients/:id/risk', session.requireRole('clinician'), riskApi.forPatient);

/* finding a doctor */
router.get('/doctors', careApi.doctors);
router.get('/doctors/recommended', careApi.recommended);
router.get('/me/doctor', session.requireRole('clinician'), careApi.me);
router.patch('/me/doctor', session.requireRole('clinician'), careApi.updateMe);
// a clinician signing themselves up — the only way a doctor enters the list
router.post('/doctors/register', rateLimit.register, careApi.registerDoctor);
router.get('/doctors/:id/slots', careApi.slots);
router.get('/doctors/:id/plans', careApi.plans);
router.get('/doctors/:id/appointments', session.requireRole('clinician'), careApi.doctorAppointments);

/* appointment requests — the mother asks, the doctor answers */
router.get('/appointments', careApi.myAppointments);
/* the clinicians she is actually under, for "Your care team" */
router.get('/me/care-team', careApi.myCareTeam);
router.post('/appointments', careApi.requestAppointment);
/* paid booking — the fee confirms the slot, so there is nothing to answer */
router.post('/appointments/paid', careApi.payAndBook);
router.patch('/appointments/:id', session.requireRole('clinician'), careApi.respond);
router.delete('/appointments/:id', careApi.cancel);
/* F11: move an appointment rather than losing your place in the queue */
router.patch('/appointments/:id/reschedule', careApi.reschedule);
router.get('/appointments/:id/changes', careApi.changes);
router.get('/cancel-reasons', careApi.cancelReasons);

/* ending the care relationship — either side, with a reason */
router.get('/care-endings/reasons', careEndingApi.reasons);
router.get('/care-endings', careEndingApi.mine);
router.post('/care-endings/:doctorId', careEndingApi.endByMother);
router.get('/doctors/:doctorId/care-endings', session.requireRole('clinician'), careEndingApi.forDoctor);
router.post('/doctors/:doctorId/care-endings/:patientId', session.requireRole('clinician'), careEndingApi.endByDoctor);

/* profile: name, photo, bio — previously lost on every refresh */
router.get('/profile', profileApi.show);
router.patch('/profile', profileApi.update);
/* everything the onboarding questionnaire asked — see profileApiController */
router.get('/onboarding', profileApi.onboarding);
router.put('/onboarding', profileApi.saveOnboarding);

/* speech to text for the symptom logger — optional, see models/voiceModel */
router.get('/voice/capability', voiceApi.capability);
router.post('/voice/transcribe', voiceApi.transcribe);
router.get('/profile/avatar/:file', profileApi.avatar);

/* weight gain vs the range recommended for her starting BMI */
router.get('/weight-gain', profileApi.weightGain);

/* the downloadable health report — same document, both sides */
router.get('/report.pdf', reportApi.mine);
router.get('/patients/:id/report.pdf', session.requireRole('clinician'), reportApi.forPatient);

/* where this server can be reached from — the guardian pairing link needs it */
router.get('/network', networkApi.index);

/* vitals — the readings behind the trend charts */
router.get('/vitals', vitalApi.index);
router.post('/vitals', vitalApi.create);

/* mood, kicks and hydration she reports each day */
router.get('/daily-log', profileApi.dailyLog);
router.put('/daily-log', profileApi.saveDailyLog);

/* community board */
router.get('/community/posts', communityApi.index);
/* the sidebar's cohort figures — counted per mother, from her own week */
router.get('/community/week-group', communityApi.weekGroup);
router.post('/community/posts', communityApi.create);
router.post('/community/posts/:id/comments', communityApi.comment);
router.post('/community/posts/:id/heart', communityApi.heart);
router.get('/community/images/:file', communityApi.image);

/* reporting — :target is 'posts' or 'comments' */
router.post('/community/:target/:id/report', communityApi.report);

/* moderation — the clinician's queue */
router.get('/moderation/reports', session.requireRole('clinician'), moderationApi.queue);
router.get('/moderation/count', session.requireRole('clinician'), moderationApi.count);
router.post('/moderation/:target/:id/resolve', session.requireRole('clinician'), moderationApi.resolve);

/* child: growth, milestones, vaccinations — the React client had no route
   to these, so it drew them from hardcoded arrays */
router.get('/child', childApi.show);
router.post('/child/growth', childApi.addGrowth);
router.patch('/child/milestones/:id', childApi.toggleMilestone);
/* the child's own daily check-in — feeds, nappies, sleep, temperature */
router.get('/child/log', childApi.log);
router.patch('/child/log', childApi.saveLog);

/* the child's symptom journal — the mother's is under /symptoms */
router.get('/child/symptoms', childApi.symptoms);
router.put('/child/symptoms', childApi.replaceSymptoms);
router.post('/child/symptoms/end-entry', childApi.endSymptomEntry);

router.get('/vaccinations', childApi.vaccinations);
router.patch('/vaccinations/:id/done', childApi.markVaccinationDone);
/* undo a dose ticked by mistake — deletes the completion, not the dose */
router.delete('/vaccinations/:id/done', childApi.undoVaccinationDone);
router.post('/vaccinations/:id/card', childApi.uploadVaccinationCard);

/* the guardian companion app — scoped by link token, read-only */
router.get('/guardian/:token', guardianApi.dashboard);
router.get('/guardian/:token/vitals', guardianApi.vitals);
router.get('/guardian/:token/alert', guardianApi.alert);
router.post('/guardian/:token/ack', guardianApi.acknowledge);

/* emergency SOS */
router.get('/sos', sosApi.state);
router.post('/sos', sosApi.trigger);
router.post('/sos/:id/close', sosApi.close);
router.patch('/sos/emergency-number', sosApi.setEmergencyNumber);
router.get('/guardians', sosApi.contacts);
router.post('/guardians', sosApi.addContact);
router.delete('/guardians/:id', sosApi.removeContact);
router.get('/doctors/:id/sos', session.requireRole('clinician'), sosApi.forDoctor);

/* prescriptions & reports */
router.get('/documents', documentApi.index);
router.post('/documents', documentApi.create);
router.get('/documents/:id/file', documentApi.file);
router.delete('/documents/:id', documentApi.destroy);
router.get('/patients/:id/documents', session.requireRole('clinician'), documentApi.forPatient);
router.post('/patients/:id/documents', session.requireRole('clinician'), documentApi.createForPatient);

/* messages — the mother/doctor conversation */
router.get('/care-team', messageApi.careTeam);
router.get('/messages', messageApi.threads);
router.post('/messages', messageApi.send);
/* photographs sent in a thread, streamed from disk */
router.get('/messages/attachments/:file', messageApi.attachment);
router.get('/messages/:doctorId', messageApi.thread);
router.get('/doctors/:id/threads', session.requireRole('clinician'), messageApi.doctorThreads);
router.get('/doctors/:id/threads/:patientId', session.requireRole('clinician'), messageApi.doctorThread);
router.post('/doctors/:id/messages', session.requireRole('clinician'), messageApi.doctorSend);
/* visits about to start — drives the "ready your meeting link" nudge */
router.get('/doctors/:id/upcoming', session.requireRole('clinician'), messageApi.doctorUpcoming);

/* the account itself — her data, and closing it */
router.get('/account/export', accountApi.exportData);
/* deletion re-checks the password, so it is throttled like a sign-in */
router.delete('/account', rateLimit.password, accountApi.requestDeletion);

/* symptoms */
router.get('/symptoms', symptomApi.index);
router.put('/symptoms', symptomApi.replace);
router.post('/symptoms', symptomApi.create);
router.patch('/symptoms/:id', symptomApi.update);
router.delete('/symptoms/:id', symptomApi.destroy);
router.post('/symptoms/end-entry', symptomApi.clearConfirmations);

/* browser push — reminders reaching the device when the app is closed */
router.get('/push/key', pushApi.key);
router.get('/push/status', pushApi.status);
router.post('/push/subscriptions', pushApi.subscribe);
router.delete('/push/subscriptions', pushApi.unsubscribe);
router.post('/push/test', pushApi.test);

/* reminders & appointments */
router.get('/reminders', reminderApi.index);
router.post('/reminders', reminderApi.create);
router.delete('/reminders/:id', reminderApi.destroy);

module.exports = router;
