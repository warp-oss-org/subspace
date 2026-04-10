package plan

type Plan struct {
	Primitive string
	Adapter   string

	Dirs  []DirOp
	Files []FileOp

	Deps []string
}

type DirOp struct {
	Path string
}

type FileOp struct {
	SrcPath  string
	DestPath string
	Template bool
}
