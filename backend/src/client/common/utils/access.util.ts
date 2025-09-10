export type CompanyGrade = 'free' | 'standard' | 'business';
export function gradeToLevel(g: CompanyGrade) { return g === 'free' ? 0 : g === 'standard' ? 1 : 2; }
/** musics.grade_required: 0=모두, 1/2=구독 필요 */
export function canUseTrack(companyGrade: CompanyGrade, trackGradeRequired: 0|1|2) {
  const lvl = gradeToLevel(companyGrade);
  return trackGradeRequired === 0 ? true : (lvl >= 1); // standard/business만
}
