namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Compares strings naturally so page2 sorts before page10.
/// </summary>
public sealed class NaturalStringComparer : IComparer<string>
{
    /// <summary>
    /// Gets the shared comparer instance.
    /// </summary>
    public static NaturalStringComparer Instance { get; } = new();

    /// <inheritdoc />
    public int Compare(string? x, string? y)
    {
        if (ReferenceEquals(x, y))
        {
            return 0;
        }

        if (x is null)
        {
            return -1;
        }

        if (y is null)
        {
            return 1;
        }

        var xi = 0;
        var yi = 0;

        while (xi < x.Length && yi < y.Length)
        {
            var xIsDigit = char.IsAsciiDigit(x[xi]);
            var yIsDigit = char.IsAsciiDigit(y[yi]);

            if (xIsDigit && yIsDigit)
            {
                var result = CompareDigitRuns(x, ref xi, y, ref yi);
                if (result != 0)
                {
                    return result;
                }

                continue;
            }

            var xChar = char.ToUpperInvariant(x[xi]);
            var yChar = char.ToUpperInvariant(y[yi]);
            if (xChar != yChar)
            {
                return xChar.CompareTo(yChar);
            }

            xi++;
            yi++;
        }

        return (x.Length - xi).CompareTo(y.Length - yi);
    }

    private static int CompareDigitRuns(string x, ref int xi, string y, ref int yi)
    {
        var xRunStart = xi;
        var yRunStart = yi;

        while (xi < x.Length && char.IsAsciiDigit(x[xi]))
        {
            xi++;
        }

        while (yi < y.Length && char.IsAsciiDigit(y[yi]))
        {
            yi++;
        }

        var xSignificant = xRunStart;
        var ySignificant = yRunStart;

        while (xSignificant < xi - 1 && x[xSignificant] == '0')
        {
            xSignificant++;
        }

        while (ySignificant < yi - 1 && y[ySignificant] == '0')
        {
            ySignificant++;
        }

        var xSignificantLength = xi - xSignificant;
        var ySignificantLength = yi - ySignificant;
        if (xSignificantLength != ySignificantLength)
        {
            return xSignificantLength.CompareTo(ySignificantLength);
        }

        for (var i = 0; i < xSignificantLength; i++)
        {
            var comparison = x[xSignificant + i].CompareTo(y[ySignificant + i]);
            if (comparison != 0)
            {
                return comparison;
            }
        }

        var xRunLength = xi - xRunStart;
        var yRunLength = yi - yRunStart;
        return xRunLength.CompareTo(yRunLength);
    }
}
