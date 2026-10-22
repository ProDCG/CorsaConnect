"""Pure-Python ISO/IEC 18004 QR Code Matrix Generator (Versions 1-10, Error Correction L).

Zero external dependencies — guarantees real, scannable QR codes even if
third-party `qrcode` is not installed in the Python environment.
"""

from __future__ import annotations

# Version capacities (Byte mode, ECC Level L): (total_codewords, ec_codewords_per_block, num_blocks)
# For URLs up to ~130 chars (our checkin URLs are ~88 chars -> Version 5 or 6)
_VERSION_INFO: dict[int, tuple[int, int, int, list[int]]] = {
    1: (26, 7, 1, []),
    2: (44, 10, 1, [6, 18]),
    3: (70, 15, 1, [6, 22]),
    4: (100, 20, 1, [6, 26]),
    5: (134, 26, 1, [6, 30]),
    6: (172, 18, 2, [6, 34]),
    7: (196, 20, 2, [6, 22, 38]),
    8: (242, 24, 2, [6, 24, 42]),
    9: (292, 30, 2, [6, 26, 46]),
    10: (346, 18, 4, [6, 28, 50]),
}

# GF(256) tables with primitive polynomial 0x11D
_EXP = [0] * 512
_LOG = [0] * 256
_v = 1
for _i in range(255):
    _EXP[_i] = _v
    _LOG[_v] = _i
    _v <<= 1
    if _v & 0x100:
        _v ^= 0x11D
for _i in range(255, 512):
    _EXP[_i] = _EXP[_i - 255]


def _gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return _EXP[_LOG[a] + _LOG[b]]


def _rs_generator_poly(degree: int) -> list[int]:
    poly = [1]
    for i in range(degree):
        next_poly = [0] * (len(poly) + 1)
        root = _EXP[i]
        for j, coeff in enumerate(poly):
            next_poly[j] ^= coeff
            next_poly[j + 1] ^= _gf_mul(coeff, root)
        poly = next_poly
    return poly


def _rs_encode(data: list[int], ec_len: int) -> list[int]:
    gen = _rs_generator_poly(ec_len)
    rem = [0] * ec_len
    for b in data:
        factor = b ^ rem[0]
        rem = rem[1:] + [0]
        if factor != 0:
            for i in range(ec_len):
                rem[i] ^= _gf_mul(gen[i + 1], factor)
    return rem


def _bch_format_bits(ec_level: int, mask: int) -> int:
    # ECC Level L = 0b01
    data = ((ec_level & 0x3) << 3) | (mask & 0x7)
    rem = data << 10
    for i in range(4, -1, -1):
        if rem & (1 << (i + 10)):
            rem ^= 0x537 << i
    return ((data << 10) | rem) ^ 0x5412


def _bch_version_bits(version: int) -> int:
    rem = version << 12
    for i in range(5, -1, -1):
        if rem & (1 << (i + 12)):
            rem ^= 0x1F25 << i
    return (version << 12) | rem


def generate_qr_matrix(text: str, border: int = 2) -> list[list[bool]]:
    """Return a 2D boolean matrix (True = black module, False = white module) for `text`."""
    try:
        import qrcode  # type: ignore[import-untyped]

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=1,
            border=border,
        )
        qr.add_data(text)
        qr.make(fit=True)
        return [[bool(cell) for cell in row] for row in qr.get_matrix()]
    except Exception:
        pass

    payload = text.encode("utf-8")
    n_bytes = len(payload)

    # Pick minimum version that fits n_bytes in Byte mode (Level L)
    version = 10
    for ver, (total_cw, ec_cw, blocks, _) in _VERSION_INFO.items():
        data_cw = total_cw - ec_cw * blocks
        len_bits = 8 if ver < 10 else 16
        max_bytes = (data_cw * 8 - 4 - len_bits) // 8
        if n_bytes <= max_bytes:
            version = ver
            break

    total_cw, ec_cw, num_blocks, align_coords = _VERSION_INFO[version]
    data_cw_total = total_cw - ec_cw * num_blocks

    # Build bit stream: Mode 0100 (Byte), character count, payload bytes, terminator
    bits: list[int] = [0, 1, 0, 0]
    count_bits = 8 if version < 10 else 16
    for i in range(count_bits - 1, -1, -1):
        bits.append((n_bytes >> i) & 1)
    for b in payload:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)

    max_bits = data_cw_total * 8
    term_len = min(4, max_bits - len(bits))
    bits.extend([0] * term_len)
    while len(bits) % 8 != 0:
        bits.append(0)

    codewords: list[int] = []
    for i in range(0, len(bits), 8):
        byte_val = 0
        for bit in bits[i : i + 8]:
            byte_val = (byte_val << 1) | bit
        codewords.append(byte_val)

    pad_bytes = [0xEC, 0x11]
    pad_idx = 0
    while len(codewords) < data_cw_total:
        codewords.append(pad_bytes[pad_idx % 2])
        pad_idx += 1

    # Split into blocks and compute Reed-Solomon EC codewords
    base_block_len = data_cw_total // num_blocks
    extra_blocks = data_cw_total % num_blocks
    data_blocks: list[list[int]] = []
    ec_blocks: list[list[int]] = []
    offset = 0
    for b_idx in range(num_blocks):
        b_len = base_block_len + (1 if b_idx >= num_blocks - extra_blocks else 0)
        blk = codewords[offset : offset + b_len]
        offset += b_len
        data_blocks.append(blk)
        ec_blocks.append(_rs_encode(blk, ec_cw))

    # Interleave data and EC codewords
    interleaved: list[int] = []
    max_blk_len = max(len(b) for b in data_blocks)
    for i in range(max_blk_len):
        for blk in data_blocks:
            if i < len(blk):
                interleaved.append(blk[i])
    for i in range(ec_cw):
        for blk in ec_blocks:
            interleaved.append(blk[i])

    final_bits: list[int] = []
    for cw in interleaved:
        for i in range(7, -1, -1):
            final_bits.append((cw >> i) & 1)

    size = 17 + 4 * version
    modules: list[list[bool]] = [[False] * size for _ in range(size)]
    is_func: list[list[bool]] = [[False] * size for _ in range(size)]

    def set_func(r: int, c: int, val: bool) -> None:
        if 0 <= r < size and 0 <= c < size:
            modules[r][c] = val
            is_func[r][c] = True

    # Finder patterns + separators
    for fr, fc in ((0, 0), (0, size - 7), (size - 7, 0)):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = fr + dr, fc + dc
                if 0 <= r < size and 0 <= c < size:
                    in_square = 0 <= dr <= 6 and 0 <= dc <= 6
                    val = in_square and (dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4))
                    set_func(r, c, val)

    # Timing patterns
    for i in range(8, size - 8):
        set_func(6, i, i % 2 == 0)
        set_func(i, 6, i % 2 == 0)

    # Alignment patterns
    for ar in align_coords:
        for ac in align_coords:
            if (ar == 6 and ac == 6) or (ar == 6 and ac == size - 7) or (ar == size - 7 and ac == 6):
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    val = max(abs(dr), abs(dc)) in (0, 2)
                    set_func(ar + dr, ac + dc, val)

    # Dark module + reserved format areas
    set_func(4 * version + 9, 8, True)
    for i in range(9):
        if i != 6:
            if not is_func[8][i]:
                set_func(8, i, False)
            if not is_func[i][8]:
                set_func(i, 8, False)
    for i in range(8):
        if not is_func[8][size - 1 - i]:
            set_func(8, size - 1 - i, False)
        if not is_func[size - 1 - i][8]:
            set_func(size - 1 - i, 8, False)

    # Version info for version >= 7
    if version >= 7:
        vbits = _bch_version_bits(version)
        for i in range(18):
            bit = bool((vbits >> i) & 1)
            r, c = i // 3, size - 11 + (i % 3)
            set_func(r, c, bit)
            set_func(c, r, bit)

    # Place data bits in upward/downward 2-column zig-zag
    bit_idx = 0
    col = size - 1
    upward = True
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(size - 1, -1, -1) if upward else range(size)
        for r in rows:
            for dc in (0, -1):
                c = col + dc
                if not is_func[r][c]:
                    val = bool(final_bits[bit_idx]) if bit_idx < len(final_bits) else False
                    bit_idx += 1
                    # Apply Mask 0: (r + c) % 2 == 0
                    if (r + c) % 2 == 0:
                        val = not val
                    modules[r][c] = val
        upward = not upward
        col -= 2

    # Write format bits (ECC Level L = 1, Mask = 0)
    fbits = _bch_format_bits(1, 0)
    for i in range(6):
        set_func(8, i, bool((fbits >> i) & 1))
    set_func(8, 7, bool((fbits >> 6) & 1))
    set_func(8, 8, bool((fbits >> 7) & 1))
    set_func(7, 8, bool((fbits >> 8) & 1))
    for i in range(9, 15):
        set_func(14 - i, 8, bool((fbits >> i) & 1))

    for i in range(8):
        set_func(size - 1 - i, 8, bool((fbits >> i) & 1))
    for i in range(8, 15):
        set_func(8, size - 15 + i, bool((fbits >> i) & 1))

    # Add quiet-zone border
    total_size = size + 2 * border
    bordered: list[list[bool]] = [[False] * total_size for _ in range(total_size)]
    for r in range(size):
        for c in range(size):
            bordered[r + border][c + border] = modules[r][c]
    return bordered
