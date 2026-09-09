// 老师身份展示：平台唯一合作院校为湖南师范大学，前端（含管理端列表/详情）统一
// 不展示学校名，只展示「学院 · 专业」（college / major）。
// 兼容旧数据：school 形如「湖南大学 · 数学系」时去掉校名仅保留后半段；纯校名或占位返回空串。
export interface IdentityLike {
  college?: string;
  major?: string;
  school?: string;
}

export function teacherCollegeMajorText(p?: IdentityLike | null): string {
  const college = (p?.college || "").trim();
  const major = (p?.major || "").trim();
  if (college || major) return [college, major].filter(Boolean).join(" · ");
  const school = (p?.school || "").trim();
  if (!school || school === "在读大学生") return "";
  const parts = school.split("·").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts.slice(1).join(" · ");
  return "";
}

// 身份行兜底：查无学院/专业历史数据时给出通用称谓，避免空行
export function teacherIdentityLabel(p?: IdentityLike | null): string {
  return teacherCollegeMajorText(p) || "在读大学生";
}
