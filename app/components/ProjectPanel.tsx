'use client'

import type { Project } from '../data/projects'

export default function ProjectPanel({
  project,
  visible,
}: {
  project: Project | null
  visible: boolean
}) {
  if (!project || !project.stack) return null

  return (
    <>
      <style jsx>{`
        @keyframes portalOpen {
          0% {
            clip-path: circle(0% at 50% 50%);
            backdrop-filter: blur(0px);
          }
          100% {
            clip-path: circle(75% at 50% 50%);
            backdrop-filter: blur(12px);
          }
        }
        @keyframes portalClose {
          0% {
            clip-path: circle(75% at 50% 50%);
            backdrop-filter: blur(12px);
          }
          100% {
            clip-path: circle(0% at 50% 50%);
            backdrop-filter: blur(0px);
          }
        }
        @keyframes contentReveal {
          0% {
            opacity: 0;
            transform: scale(0.8);
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px);
          }
        }
        @keyframes contentHide {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px);
          }
          100% {
            opacity: 0;
            transform: scale(0.85);
            filter: blur(6px);
          }
        }
      `}</style>

      {/* Portal overlay */}
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{
          background: 'rgba(5, 5, 16, 0.88)',
          animation: visible
            ? 'portalOpen 1.8s cubic-bezier(0.16, 1, 0.3, 1) both'
            : 'portalClose 0.6s cubic-bezier(0.7, 0, 0.84, 0) forwards',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {/* Content container */}
        <div
          className="min-h-screen flex items-start justify-center px-6 py-20"
          style={{
            animation: visible
              ? 'contentReveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both'
              : 'contentHide 0.4s ease-in forwards',
          }}
        >
          <div className="max-w-2xl w-full">

            {/* Accent bar */}
            <div
              className="h-1 w-24 rounded-full mb-8"
              style={{ background: project.color }}
            />

            {/* Title */}
            <h1
              className="text-5xl font-bold mb-4 tracking-tight"
              style={{ color: project.color }}
            >
              {project.title}
            </h1>

            {/* Description */}
            <p className="text-lg text-slate-300 leading-relaxed mb-10">
              {project.description}
            </p>

            {/* Tech stack */}
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Tech Stack
              </h2>
              <div className="flex flex-wrap gap-2">
                {project.stack.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      background: `${project.color}15`,
                      color: project.color,
                      border: `1px solid ${project.color}30`,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-4 mb-16">
              {project.url && (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105"
                  style={{
                    background: project.color,
                    color: '#050510',
                  }}
                >
                  Visit Site
                </a>
              )}
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105 border"
                  style={{
                    borderColor: `${project.color}40`,
                    color: project.color,
                  }}
                >
                  GitHub
                </a>
              )}
            </div>

            {/* Exit hint */}
            <p className="text-slate-600 text-sm">
              Press <span style={{ color: project.color }} className="font-semibold">E</span> to return
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
