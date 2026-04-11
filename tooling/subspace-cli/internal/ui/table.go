package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func renderTable(st styles, headers []string, rows [][]string) string {
	if len(headers) == 0 {
		return ""
	}

	widths := make([]int, len(headers))
	for i, header := range headers {
		widths[i] = lipgloss.Width(header)
	}
	for _, row := range rows {
		for i := range headers {
			if i >= len(row) {
				continue
			}
			if w := lipgloss.Width(row[i]); w > widths[i] {
				widths[i] = w
			}
		}
	}

	headerStyle := st.label.Padding(0, 1)
	cellStyle := lipgloss.NewStyle().Padding(0, 1).Foreground(lipgloss.Color("250"))
	if st.label.GetForeground() == nil {
		cellStyle = lipgloss.NewStyle().Padding(0, 1)
	}
	mutedBorder := st.border
	if st.label.GetForeground() == nil {
		mutedBorder = lipgloss.NewStyle()
	}

	var b strings.Builder
	b.WriteString(renderTopBorder(mutedBorder, widths))
	b.WriteByte('\n')
	b.WriteString(renderBorderedRow(headerStyle, mutedBorder, headers, widths))
	if len(rows) > 0 {
		b.WriteByte('\n')
		b.WriteString(renderMiddleBorder(mutedBorder, widths))
	}
	for _, row := range rows {
		b.WriteByte('\n')
		b.WriteString(renderBorderedRow(cellStyle, mutedBorder, row, widths))
	}
	b.WriteByte('\n')
	b.WriteString(renderBottomBorder(mutedBorder, widths))
	return b.String()
}

func renderBorderedRow(style lipgloss.Style, borderStyle lipgloss.Style, cols []string, widths []int) string {
	rendered := make([]string, len(widths))
	for i := range widths {
		value := ""
		if i < len(cols) {
			value = cols[i]
		}
		rendered[i] = style.Width(widths[i] + 2).Render(value)
	}
	return borderStyle.Render("│") + strings.Join(rendered, borderStyle.Render("│")) + borderStyle.Render("│")
}

func renderTopBorder(style lipgloss.Style, widths []int) string {
	return renderBorder(style, "╭", "┬", "╮", widths)
}

func renderMiddleBorder(style lipgloss.Style, widths []int) string {
	return renderBorder(style, "├", "┼", "┤", widths)
}

func renderBottomBorder(style lipgloss.Style, widths []int) string {
	return renderBorder(style, "╰", "┴", "╯", widths)
}

func renderBorder(style lipgloss.Style, left, join, right string, widths []int) string {
	parts := make([]string, len(widths))
	for i, width := range widths {
		parts[i] = strings.Repeat("─", width+2)
	}
	return style.Render(left + strings.Join(parts, join) + right)
}
