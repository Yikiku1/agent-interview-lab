"use client";

import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  presetLabels,
  projectLabels,
  priorityLabels,
  kindLabels,
} from "@/lib/learning-options";
import type { LearningScope } from "@/lib/learning-contract";

export function LearningScopeFields({
  initial = {},
  prefix,
  target = false,
}: {
  initial?: LearningScope;
  prefix: string;
  target?: boolean;
}) {
  const [scope, setScope] = useState(initial);
  const general = scope.preset === "general_core";
  const projects =
    scope.preset === "project_story"
      ? projectLabels.slice(0, 3)
      : scope.preset === "foundation_fill"
        ? ["技术基础"]
        : projectLabels;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field>
        <FieldLabel htmlFor={`${prefix}-preset`}>训练预设</FieldLabel>
        <select
          id={`${prefix}-preset`}
          name="preset"
          className="control"
          value={scope.preset ?? ""}
          onChange={(event) => {
            const preset = event.target.value as LearningScope["preset"];
            setScope({
              preset: preset || undefined,
              ...(preset && preset !== "general_core"
                ? { track: "resume" }
                : {}),
            });
          }}
        >
          {!target ? <option value="">自选范围</option> : null}
          {Object.entries(presetLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {!target ? (
        <Field>
          <FieldLabel htmlFor={`${prefix}-track`}>题库范围</FieldLabel>
          <select
            id={`${prefix}-track`}
            name="track"
            className="control"
            value={scope.track ?? ""}
            disabled={Boolean(scope.preset)}
            onChange={(event) =>
              setScope({
                track: event.target.value === "resume" ? "resume" : undefined,
              })
            }
          >
            <option value="">全部题目</option>
            <option value="resume">简历专项</option>
          </select>
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`${prefix}-project`}>项目范围</FieldLabel>
        <select
          id={`${prefix}-project`}
          name="project"
          className="control"
          value={scope.project ?? ""}
          disabled={general}
          onChange={(event) =>
            setScope({
              ...scope,
              project:
                (event.target.value as LearningScope["project"]) || undefined,
              track: "resume",
            })
          }
        >
          <option value="">预设内全部</option>
          {projects.map((project) => (
            <option key={project}>{project}</option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-priority`}>简历优先级</FieldLabel>
        <select
          id={`${prefix}-priority`}
          name="resumePriority"
          className="control"
          value={scope.resumePriority ?? ""}
          disabled={general}
          onChange={(event) =>
            setScope({
              ...scope,
              resumePriority:
                (event.target.value as LearningScope["resumePriority"]) ||
                undefined,
              track: "resume",
            })
          }
        >
          <option value="">全部优先级</option>
          {priorityLabels.map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>
      </Field>
      {!target ? (
        <Field>
          <FieldLabel htmlFor={`${prefix}-kind`}>回答性质</FieldLabel>
          <select
            id={`${prefix}-kind`}
            name="resumeKind"
            className="control"
            value={scope.resumeKind ?? ""}
            disabled={general}
            onChange={(event) =>
              setScope({
                ...scope,
                resumeKind:
                  (event.target.value as LearningScope["resumeKind"]) ||
                  undefined,
                track: "resume",
              })
            }
          >
            <option value="">全部性质</option>
            {kindLabels.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}
