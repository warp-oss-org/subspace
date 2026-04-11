package ui

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"golang.org/x/term"
)

type Tone string

const (
	ToneAccent  Tone = "accent"
	ToneSuccess Tone = "success"
	ToneWarning Tone = "warning"
	ToneMuted   Tone = "muted"
	ToneError   Tone = "error"
)

type Session struct {
	In          io.Reader
	Out         io.Writer
	Err         io.Writer
	color       bool
	interactive bool
	styles      styles
}

type styles struct {
	title    lipgloss.Style
	subtitle lipgloss.Style
	section  lipgloss.Style
	label    lipgloss.Style
	muted    lipgloss.Style
	command  lipgloss.Style
	badge    lipgloss.Style
	success  lipgloss.Style
	warning  lipgloss.Style
	error_   lipgloss.Style
	accent   lipgloss.Style
	border   lipgloss.Style
	dim      lipgloss.Style
}

func NewSession(in io.Reader, out, err io.Writer) Session {
	interactive := isTerminalReader(in) && isTerminalWriter(out)
	color := interactive && os.Getenv("NO_COLOR") == "" && os.Getenv("TERM") != "dumb"

	return Session{
		In:          in,
		Out:         out,
		Err:         err,
		color:       color,
		interactive: interactive,
		styles:      newStyles(color),
	}
}

func (s Session) Interactive() bool {
	return s.interactive
}

func (s Session) ColorEnabled() bool {
	return s.color
}

func (s Session) Println(text string) {
	fmt.Fprintln(s.Out, text)
}

func (s Session) Errorln(text string) {
	fmt.Fprintln(s.Err, text)
}

// Banner renders a branded header with the tool name and optional tagline.
//
//	╭─────────────────────────────────────╮
//	│  ◆ Subspace                         │
//	│  Scaffold complete                  │
//	╰─────────────────────────────────────╯
func (s Session) Banner(title, subtitle string) string {
	diamond := s.styles.accent.Render("◆")

	titleLine := diamond + " " + s.styles.title.Render(title)
	lines := []string{titleLine}
	if subtitle != "" {
		lines = append(lines, s.styles.subtitle.Render(subtitle))
	}

	content := strings.Join(lines, "\n")

	if !s.color {
		return content
	}

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("240")).
		Padding(0, 2)

	return box.Render(content)
}

// Title renders a prominent heading with optional subtitle below.
func (s Session) Title(title, subtitle string) string {
	if subtitle == "" {
		return s.styles.title.Render(title)
	}
	return s.styles.title.Render(title) + "\n" + s.styles.subtitle.Render(subtitle)
}

func (s Session) Section(title string) string {
	return s.styles.section.Render(title)
}

func (s Session) Label(label string) string {
	return s.styles.label.Render(label)
}

func (s Session) Muted(text string) string {
	return s.styles.muted.Render(text)
}

func (s Session) Command(cmd string) string {
	return s.styles.command.Render(cmd)
}

func (s Session) Badge(text string, tone Tone) string {
	style := s.styles.badge
	if s.color {
		switch tone {
		case ToneSuccess:
			style = style.Foreground(lipgloss.Color("42"))
		case ToneWarning:
			style = style.Foreground(lipgloss.Color("214"))
		case ToneError:
			style = style.Foreground(lipgloss.Color("196"))
		case ToneMuted:
			style = style.Foreground(lipgloss.Color("245"))
		default:
			style = style.Foreground(lipgloss.Color("39"))
		}
	}
	return style.Render(text)
}

// StatusBadge renders a pill-style status indicator like [RUNNING] in color.
func (s Session) StatusBadge(text string, tone Tone) string {
	if !s.color {
		return s.styles.badge.Render(strings.ToUpper(text))
	}

	var fg, bg lipgloss.Color
	switch tone {
	case ToneSuccess:
		fg = lipgloss.Color("0")
		bg = lipgloss.Color("42")
	case ToneWarning:
		fg = lipgloss.Color("0")
		bg = lipgloss.Color("214")
	case ToneError:
		fg = lipgloss.Color("15")
		bg = lipgloss.Color("196")
	default:
		fg = lipgloss.Color("15")
		bg = lipgloss.Color("39")
	}

	return lipgloss.NewStyle().
		Bold(true).
		Foreground(fg).
		Background(bg).
		Padding(0, 1).
		Render(strings.ToUpper(text))
}

func (s Session) Status(text string, tone Tone) string {
	switch tone {
	case ToneSuccess:
		return s.styles.success.Render("✓ " + text)
	case ToneWarning:
		return s.styles.warning.Render("! " + text)
	case ToneError:
		return s.styles.error_.Render("✗ " + text)
	default:
		return text
	}
}

// Step renders a completed step indicator:  ✓ Connecting to repository
func (s Session) Step(text string) string {
	check := s.styles.success.Render("✓")
	return check + " " + s.styles.dim.Render(text)
}

// StepWarn renders a warning step:  ! Something to note
func (s Session) StepWarn(text string) string {
	mark := s.styles.warning.Render("!")
	return mark + " " + s.styles.dim.Render(text)
}

// Divider renders a subtle horizontal rule.
func (s Session) Divider() string {
	if !s.color {
		return strings.Repeat("─", 40)
	}
	return s.styles.border.Render(strings.Repeat("─", 40))
}

// InfoBox renders key-value pairs inside a bordered box.
//
//	╭──────────────────────────────────╮
//	│  Workspace    text-the-internet  │
//	│  State        RUNNING            │
//	│  Editor       VSCode (Browser)   │
//	╰──────────────────────────────────╯
func (s Session) InfoBox(rows [][2]string) string {
	if len(rows) == 0 {
		return ""
	}

	kv := s.KeyValue(rows)

	if !s.color {
		return kv
	}

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("240")).
		Padding(0, 2)

	return box.Render(kv)
}

// InfoBoxWithTitle renders a titled info box.
//
//	╭ Workspace info ──────────────────╮
//	│  Name     text-the-internet      │
//	│  State    RUNNING                │
//	╰──────────────────────────────────╯
func (s Session) InfoBoxWithTitle(title string, rows [][2]string) string {
	if len(rows) == 0 {
		return ""
	}

	kv := s.KeyValue(rows)

	if !s.color {
		header := s.Section(title)
		return header + "\n" + kv
	}

	titleRendered := " " + s.styles.section.Render(title) + " "

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderTop(true).
		BorderBottom(true).
		BorderLeft(true).
		BorderRight(true).
		Padding(0, 2)

	boxStr := box.Render(kv)

	// Replace the top border's first segment with the title
	lines := strings.Split(boxStr, "\n")
	if len(lines) > 0 {
		topBorder := lines[0]
		// Find position after "╭" to insert the title
		if idx := strings.Index(topBorder, "─"); idx >= 0 {
			titleWidth := lipgloss.Width(titleRendered)
			borderRunes := []rune(topBorder)
			// Count visible width up to first dash
			remaining := string(borderRunes[idx:])
			remainingWidth := lipgloss.Width(remaining)
			if titleWidth < remainingWidth {
				lines[0] = string(borderRunes[:idx]) + titleRendered + s.styles.border.Render(strings.Repeat("─", remainingWidth-titleWidth-1)) + string(borderRunes[len(borderRunes)-1:])
			}
		}
	}

	return strings.Join(lines, "\n")
}

func (s Session) KeyValue(rows [][2]string) string {
	if len(rows) == 0 {
		return ""
	}

	width := 0
	for _, row := range rows {
		if w := lipgloss.Width(row[0]); w > width {
			width = w
		}
	}

	var b strings.Builder
	for i, row := range rows {
		if i > 0 {
			b.WriteByte('\n')
		}
		b.WriteString(s.styles.label.Width(width).Render(row[0]))
		b.WriteString("  ")
		b.WriteString(row[1])
	}
	return b.String()
}

func (s Session) Table(headers []string, rows [][]string) string {
	return renderTable(s.styles, headers, rows)
}

func (s Session) PromptSelect(label string, options []string, defaultValue string) (string, error) {
	if !s.interactive {
		return "", fmt.Errorf("prompt requires interactive terminal")
	}

	fmt.Fprintln(s.Out)
	fmt.Fprintln(s.Out, s.Section(label))
	fmt.Fprintln(s.Out)
	for _, option := range options {
		marker := s.styles.muted.Render("  ○")
		badge := ""
		if option == defaultValue {
			marker = s.styles.accent.Render("  ●")
			badge = " " + s.Badge("default", ToneAccent)
		}
		fmt.Fprintf(s.Out, "%s %s%s\n", marker, option, badge)
	}
	if defaultValue != "" {
		fmt.Fprintf(s.Out, "\n%s %s\n", s.Muted("Press Enter for default:"), defaultValue)
	}
	fmt.Fprint(s.Out, s.styles.accent.Render("❯ "))

	reader := bufio.NewReader(s.In)
	line, err := reader.ReadString('\n')
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("read selection: %w", err)
	}
	line = strings.TrimSpace(line)
	if line == "" && defaultValue != "" {
		return defaultValue, nil
	}

	for i, option := range options {
		if line == fmt.Sprintf("%d", i+1) || strings.EqualFold(line, option) {
			return option, nil
		}
	}
	return "", fmt.Errorf("invalid selection %q", line)
}

func newStyles(color bool) styles {
	if !color {
		return styles{
			title:    lipgloss.NewStyle().Bold(true),
			subtitle: lipgloss.NewStyle(),
			section:  lipgloss.NewStyle().Bold(true),
			label:    lipgloss.NewStyle().Bold(true),
			muted:    lipgloss.NewStyle(),
			command:  lipgloss.NewStyle().Bold(true),
			badge:    lipgloss.NewStyle().Bold(true),
			success:  lipgloss.NewStyle().Bold(true),
			warning:  lipgloss.NewStyle().Bold(true),
			error_:   lipgloss.NewStyle().Bold(true),
			accent:   lipgloss.NewStyle().Bold(true),
			border:   lipgloss.NewStyle(),
			dim:      lipgloss.NewStyle(),
		}
	}

	return styles{
		title:    lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("15")),
		subtitle: lipgloss.NewStyle().Foreground(lipgloss.Color("248")),
		section:  lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("252")),
		label:    lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("248")),
		muted:    lipgloss.NewStyle().Foreground(lipgloss.Color("243")),
		command:  lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("75")),
		badge:    lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("244")),
		success:  lipgloss.NewStyle().Foreground(lipgloss.Color("78")).Bold(true),
		warning:  lipgloss.NewStyle().Foreground(lipgloss.Color("214")).Bold(true),
		error_:   lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true),
		accent:   lipgloss.NewStyle().Foreground(lipgloss.Color("75")).Bold(true),
		border:   lipgloss.NewStyle().Foreground(lipgloss.Color("240")),
		dim:      lipgloss.NewStyle().Foreground(lipgloss.Color("250")),
	}
}

func isTerminalReader(r io.Reader) bool {
	f, ok := r.(*os.File)
	return ok && term.IsTerminal(int(f.Fd()))
}

func isTerminalWriter(w io.Writer) bool {
	f, ok := w.(*os.File)
	return ok && term.IsTerminal(int(f.Fd()))
}
