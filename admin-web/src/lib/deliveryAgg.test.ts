// 单元测试：投递聚合逻辑（Node 内置 test runner，直接跑 TS）
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupDeliveries } from "./deliveryAgg.ts";
import type { DeliveryRow } from "../types.ts";

function row(partial: Partial<DeliveryRow> & { id: string }): DeliveryRow {
  return {
    status: "待处理",
    ...partial,
  } as DeliveryRow;
}

describe("groupDeliveries 需求单聚合", () => {
  it("同一需求单的多条投递汇总到一组，计数正确", () => {
    const rows = [
      row({ id: "a1", demandId: "D1", teacherId: "t1", teacher: { name: "老师A" }, createTime: "2026-09-07T10:00:00Z" }),
      row({ id: "a2", demandId: "D1", teacherId: "t2", teacher: { name: "老师B" }, createTime: "2026-09-07T11:00:00Z", recommended: true }),
      row({ id: "a3", demandId: "D2", teacherId: "t3", teacher: { name: "老师C" }, createTime: "2026-09-07T09:00:00Z" }),
    ];
    const groups = groupDeliveries(rows);
    assert.equal(groups.length, 2);
    const g1 = groups.find((g) => g.demandId === "D1");
    assert.ok(g1);
    assert.equal(g1!.total, 2);
    assert.equal(g1!.recommendedCount, 1);
    assert.equal(g1!.items[0]!.teacherId, "t2"); // 推荐优先
  });

  it("未关联需求单的记录归入空组而非丢失", () => {
    const rows = [
      row({ id: "x1", teacherId: "t9", teacher: { name: "老师X" } }),
      row({ id: "x2", demandId: "D1", teacherId: "t1", teacher: { name: "老师A" } }),
    ];
    const groups = groupDeliveries(rows);
    assert.equal(groups.length, 2);
    assert.ok(groups.find((g) => g.demandId === ""));
    assert.equal(groups.find((g) => g.demandId === "D1")!.total, 1);
  });

  it("orderStatus 去重；最新时间取组内最大", () => {
    const rows = [
      row({ id: "b1", demandId: "D1", teacherId: "t1", createTime: "2026-09-07T10:00:00Z", orderStatus: "待联系" }),
      row({ id: "b2", demandId: "D1", teacherId: "t2", createTime: "2026-09-07T12:00:00Z", orderStatus: "已成交" }),
      row({ id: "b3", demandId: "D1", teacherId: "t3", createTime: "2026-09-07T11:00:00Z", orderStatus: "待联系" }),
    ];
    const [g] = groupDeliveries(rows);
    assert.deepEqual(g!.orderStatuses, ["待联系", "已成交"]);
    assert.equal(g!.latestTime, "2026-09-07T12:00:00Z");
  });

  it("需求单缺失字段由组内其它行补齐", () => {
    const rows = [
      row({ id: "c1", demandId: "D1", teacherId: "t1", demand: { grade: "小学一年级" } }),
      row({ id: "c2", demandId: "D1", teacherId: "t2", demand: { subject: "语文", budget: "80-120" } }),
    ];
    const [g] = groupDeliveries(rows);
    assert.equal(g!.demand!.grade, "小学一年级");
    assert.equal(g!.demand!.subject, "语文");
    assert.equal(g!.demand!.budget, "80-120");
  });
});
