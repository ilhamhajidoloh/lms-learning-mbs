#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only scratch fixture builder. Never reads production configuration or data.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..', '..');
require('@next/env').loadEnvConfig(root);
for (const k of ['USER','PASSWORD','CONNECT_STRING','WALLET_LOCATION','WALLET_PASSWORD']) process.env['ORACLE_'+k] = process.env['PHASE7_REHEARSAL_ORACLE_'+k];
process.env.DB_PROVIDER = 'postgres';
const manifest = require('../../database/migration/migration-manifest.json');
const { insertSql } = require('./import-oracle.cjs');
const { transformRow } = require('./lib/transform.cjs');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const now = '2026-10-09T00:00:00.000000Z';
const ids = { teacher:'70000000-0000-4000-8000-000000000001', student:'70000000-0000-4000-8000-000000000002', level:'70000000-0000-4000-8000-000000000003', enrollment:'70000000-0000-4000-8000-000000000004', announcement:'70000000-0000-4000-8000-000000000005', q1:'70000000-0000-4000-8000-000000000006', q2:'70000000-0000-4000-8000-000000000007', submission:'70000000-0000-4000-8000-000000000008', completion:'70000000-0000-4000-8000-000000000009' };
const key = { courses:'phase7_rehearsal_course', chapters:'phase7_rehearsal_chapter', topics:'phase7_rehearsal_topic', lessons:'phase7_rehearsal_lesson', assignments:'phase7_rehearsal_assignment', assignments2:'phase7_rehearsal_assignment_keep' };
function value(t, c) {
  if (c.nullable_target !== false) return null;
  const n = c.target || '';
  const refs = { instructor_id:ids.teacher, student_id:ids.student, teacher_id:ids.teacher, author_id:ids.teacher, created_by:ids.teacher, course_id:key.courses, chapter_id:key.chapters, topic_id:key.topics, lesson_id:key.lessons, assignment_id:key.assignments, level_value:'phase7_rehearsal_level', course_level:'phase7_rehearsal_level' };
  if (n in refs) return refs[n];
  if (n === 'quiz_review_mode') return 'full';
  if (n === 'multi_select_scoring_mode') return 'correct_only';
  if (n === 'assignment_type' || n === 'submission_type') return 'quiz';
  if (n === 'question_type') return 'multiple_choice';
  if (n === 'status') return 'pending';
  if (n === 'duration_minutes') return 30;
  if (n === 'weekday') return 1;
  if (n === 'start_time') return '09:00';
  if (n === 'end_time') return '10:00';
  if (c.transform === 'BOOLEAN_TRANSFORM') return true;
  if (c.transform === 'TIMESTAMP_TRANSFORM') return now;
  if (c.transform === 'DATE_COPY') return '2026-10-09';
  if (c.transform === 'TIME_STRING') return '09:00';
  if (c.transform === 'JSON_SERIALIZE') return JSON.stringify({ rehearsal: true, thai: 'ภาษาไทย', values: [1, null] });
  if (c.transform === 'NUMERIC_SCALE') return '1.23455';
  if (c.source_type === 'int' || c.source_type === 'smallint') return 1;
  return 'phase7_rehearsal_' + t + '_' + n;
}
function row(t, over={}) { const def=manifest.tables[t]; const r=Object.fromEntries(Object.entries(def.columns).map(([n,c])=>[n,value(t,c)])); return {...r,...over}; }
const base = Object.fromEntries(Object.keys(manifest.tables).map(t=>[t,[]]));
base.users=[row('users',{id:ids.teacher,email:'phase7.teacher@example.invalid',username:'phase7_rehearsal_teacher',display_name:'ครูทดสอบ',role:'teacher',password_hash:'not-a-password'}),row('users',{id:ids.student,email:'phase7.student@example.invalid',username:'phase7_rehearsal_student',display_name:'นักเรียนทดสอบ',role:'student',password_hash:'not-a-password'})];
base.course_levels=[row('course_levels',{id:ids.level,value:'phase7_rehearsal_level',label:'ระดับทดสอบ'})];
base.courses=[row('courses',{id:key.courses,title:'หลักสูตรทดสอบ',level:'phase7_rehearsal_level',level_label:'ระดับทดสอบ',instructor_id:ids.teacher})];
base.course_enrollments=[row('course_enrollments',{id:ids.enrollment,course_id:key.courses,student_id:ids.student})];
base.course_announcements=[row('course_announcements',{id:ids.announcement,course_id:key.courses,author_id:ids.teacher,title:'ประกาศทดสอบ',body:''})];
base.chapters=[row('chapters',{id:key.chapters,course_id:key.courses,title:'บททดสอบ',is_published:true,is_locked:false})];
base.topics=[row('topics',{id:key.topics,chapter_id:key.chapters,title:'หัวข้อทดสอบ',is_published:true,is_locked:false})];
base.lessons=[row('lessons',{id:key.lessons,topic_id:key.topics,course_id:key.courses,title:'บทเรียนภาษาไทย',description:'เนื้อหาทดสอบภาษาไทย'})];
base.assignments=[row('assignments',{id:key.assignments,course_id:key.courses,lesson_id:key.lessons,created_by:ids.teacher,type:'quiz',title:'ลบพร้อมลูก',points:'1.23455'}),row('assignments',{id:key.assignments2,course_id:key.courses,lesson_id:key.lessons,created_by:ids.teacher,type:'quiz',title:'คงไว้เพื่อ update',points:'2.34555'})];
base.quiz_questions=[row('quiz_questions',{id:ids.q1,assignment_id:key.assignments,question_text:'คำถามลบ',options:JSON.stringify(['a','b']),explanation:''}),row('quiz_questions',{id:ids.q2,assignment_id:key.assignments2,question_text:'คำถาม JSON',options:JSON.stringify(['ก่อน']),explanation:'ภาษาไทย'})];
base.submissions=[row('submissions',{id:ids.submission,assignment_id:key.assignments,student_id:ids.student,type:'quiz',score:'1.23455',question_scores:JSON.stringify({q:1}),answers:null})];
base.student_lesson_completions=[row('student_lesson_completions',{id:ids.completion,student_id:ids.student,lesson_id:key.lessons})];
const final = JSON.parse(JSON.stringify(base));
final.courses[0].title='หลักสูตรทดสอบ (ปรับปรุง)';
final.assignments[1].points='3.45655';
final.quiz_questions[1].options=JSON.stringify({nested:{thai:'ทดสอบ'},array:[1,null]});
final.quiz_questions=final.quiz_questions.filter(x=>x.id!==ids.q1); final.submissions=[]; final.assignments=final.assignments.filter(x=>x.id!==key.assignments);
final.course_announcements.push(row('course_announcements',{id:'70000000-0000-4000-8000-000000000010',course_id:key.courses,author_id:ids.teacher,title:'ประกาศใหม่',body:'English and ไทย'}));
// Same aggregate as export-cockroach.cjs: sha256 of per-row sha256(JSON.stringify(transformed values)) lines, in file order.
function logicalHash(t, rows) { const h=crypto.createHash('sha256'); for(const r of rows) h.update(sha(JSON.stringify(transformRow(manifest.tables[t],r,{allowScaleRounding:true}).values))+'\n'); return h.digest('hex'); }
function writeSnapshot(name, data) { const dir=path.join(root,'migration-data',name); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true}); const sums={tables:{}}; const order=Object.entries(manifest.tables).sort((a,b)=>a[1].order-b[1].order).map(([t])=>t); for(const t of order){const text=data[t].map(x=>JSON.stringify(x)).join('\n')+(data[t].length?'\n':'');fs.writeFileSync(path.join(dir,t+'.ndjson'),text);sums.tables[t]={sha256:sha(text),rows:data[t].length,logical_sha256:logicalHash(t,data[t])};} const mf={rehearsal_only:true,not_production:true,tool_version:'phase7-scratch-rehearsal',source:{host:'synthetic',port:'0',database:'phase7_rehearsal',kind:'synthetic'},source_schema_fingerprint:'phase7-rehearsal-synthetic-v1',migration_manifest_sha256:sha(fs.readFileSync(path.join(root,'database/migration/migration-manifest.json'),'utf8')),import_order:order,finished_at:now,tables:Object.fromEntries(order.map(t=>[t,{rows:data[t].length}]))};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(mf,null,2)+'\n');fs.writeFileSync(path.join(dir,'checksums.json'),JSON.stringify(sums,null,2)+'\n');fs.writeFileSync(path.join(dir,'row-counts.json'),JSON.stringify(Object.fromEntries(order.map(t=>[t,data[t].length])),null,2)+'\n');return dir; }
async function seed(){const o=require('oracledb');const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.ORACLE_PASSWORD,connectString:process.env.ORACLE_CONNECT_STRING,...(process.env.ORACLE_WALLET_LOCATION?{configDir:process.env.ORACLE_WALLET_LOCATION,walletLocation:process.env.ORACLE_WALLET_LOCATION}:{}),...(process.env.ORACLE_WALLET_PASSWORD?{walletPassword:process.env.ORACLE_WALLET_PASSWORD}:{})});try{const who=(await c.execute("SELECT USER AS U, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS S FROM dual",[],{outFormat:o.OUT_FORMAT_OBJECT})).rows[0];if(who.U!=='LMS_PHASE7_REHEARSAL'||who.S!=='LMS_PHASE7_REHEARSAL')throw Error('WRONG_TARGET');for(const [t,d] of Object.entries(manifest.tables).sort((a,b)=>a[1].order-b[1].order))for(const r of base[t]){const tr=transformRow(d,r,{allowScaleRounding:true});const cols=Object.values(d.columns);const binds=Object.fromEntries(tr.values.map((v,i)=>['b'+i,v===''&&cols[i].transform==='EMPTY_CLOB'?null:v]));await c.execute(insertSql(d),binds,{autoCommit:false});}await c.commit();console.log('SEEDED_ROWS='+Object.values(base).flat().length)}catch(e){await c.rollback();throw e}finally{await c.close()}}
(async()=>{const b=writeSnapshot('phase7-rehearsal-baseline',base),f=writeSnapshot('phase7-rehearsal-final',final);if(!process.argv.includes('--snapshots-only'))await seed();console.log('BASELINE='+path.relative(root,b));console.log('FINAL='+path.relative(root,f));})().catch(e=>{console.error('REHEARSAL_SETUP_FAILED='+e.message);process.exitCode=1});
