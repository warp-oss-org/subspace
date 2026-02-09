package plan

// Plan is a fully-expanded, deterministic execution plan for `subspace add`.
// It contains a list of operations to perform, plus metadata for printing summaries.
type Plan struct {
	Primitive string
	Adapter   string

	// Dirs and Files are normalized, deterministic, and should be executed in-order:
	// - create dirs first
	// - then write/copy files
	Dirs  []DirOp
	Files []FileOp

	// Deps are already merged and de-duplicated at the planning stage (optional),
	// or left raw and merged later (your choice). Keeping it here makes dry-run easy.
	Deps []string
}

type DirOp struct {
	Path string
}

// FileOp represents copying a file from registry -> destination.
// If Template is true, the source file is treated as a Go text/template and
// rendered to Dest (and typically the source filename has `.tpl` stripped by the planner).
type FileOp struct {
	SrcPath  string
	DestPath string
	Template bool
}
