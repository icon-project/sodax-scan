package main

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/srwiley/oksvg"
	"github.com/srwiley/rasterx"
	xdraw "golang.org/x/image/draw"
)

// logoSize matches the most recently added network logo (network-hedera.png).
// The explorer renders these at 16–24px, so anything square and >=180 is fine.
const logoSize = 360

// buildLogo turns a local path or URL into the png the explorer needs, plus the
// original svg bytes when the source was vector (kept alongside for crispness).
func buildLogo(src string) (pngOut, svgOut []byte, err error) {
	raw, err := readSource(src)
	if err != nil {
		return nil, nil, err
	}
	if isSVG(raw) {
		pngOut, err = rasterizeSVG(raw)
		if err != nil {
			return nil, nil, fmt.Errorf("rasterizing svg: %w", err)
		}
		return pngOut, raw, nil
	}
	img, format, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, nil, fmt.Errorf("decoding image (png/jpeg/gif/svg supported): %w", err)
	}
	if format == "png" && img.Bounds().Dx() == logoSize && img.Bounds().Dy() == logoSize {
		return raw, nil, nil
	}
	out, err := encodePNG(fit(img))
	if err != nil {
		return nil, nil, err
	}
	return out, nil, nil
}

func readSource(src string) ([]byte, error) {
	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Get(src)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("GET %s: status %d", src, resp.StatusCode)
		}
		return io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	}
	return os.ReadFile(expandHome(src))
}

func expandHome(p string) string {
	if strings.HasPrefix(p, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return home + p[1:]
		}
	}
	return p
}

func isSVG(raw []byte) bool {
	head := raw
	if len(head) > 1024 {
		head = head[:1024]
	}
	return bytes.Contains(head, []byte("<svg")) || bytes.Contains(head, []byte("<?xml"))
}

func rasterizeSVG(raw []byte) ([]byte, error) {
	icon, err := oksvg.ReadIconStream(bytes.NewReader(raw), oksvg.WarnErrorMode)
	if err != nil {
		return nil, err
	}
	vw, vh := icon.ViewBox.W, icon.ViewBox.H
	if vw <= 0 || vh <= 0 {
		vw, vh = logoSize, logoSize
	}
	// Preserve aspect ratio and centre inside the square canvas.
	scale := float64(logoSize) / vw
	if s := float64(logoSize) / vh; s < scale {
		scale = s
	}
	tw, th := vw*scale, vh*scale
	icon.SetTarget((float64(logoSize)-tw)/2, (float64(logoSize)-th)/2, tw, th)

	rgba := image.NewRGBA(image.Rect(0, 0, logoSize, logoSize))
	scanner := rasterx.NewScannerGV(logoSize, logoSize, rgba, rgba.Bounds())
	icon.Draw(rasterx.NewDasher(logoSize, logoSize, scanner), 1.0)
	return encodePNG(rgba)
}

// fit scales an image into a transparent logoSize square without distortion.
func fit(src image.Image) image.Image {
	b := src.Bounds()
	scale := float64(logoSize) / float64(b.Dx())
	if s := float64(logoSize) / float64(b.Dy()); s < scale {
		scale = s
	}
	w, h := int(float64(b.Dx())*scale), int(float64(b.Dy())*scale)
	dst := image.NewRGBA(image.Rect(0, 0, logoSize, logoSize))
	target := image.Rect((logoSize-w)/2, (logoSize-h)/2, (logoSize-w)/2+w, (logoSize-h)/2+h)
	draw.Draw(dst, dst.Bounds(), image.Transparent, image.Point{}, draw.Src)
	xdraw.CatmullRom.Scale(dst, target, src, b, xdraw.Over, nil)
	return dst
}

func encodePNG(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
