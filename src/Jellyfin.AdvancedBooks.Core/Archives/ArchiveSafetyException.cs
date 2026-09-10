namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Raised when an archive violates a defensive reader limit.
/// </summary>
public sealed class ArchiveSafetyException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ArchiveSafetyException"/> class.
    /// </summary>
    /// <param name="message">The safety validation failure.</param>
    public ArchiveSafetyException(string message)
        : base(message)
    {
    }
}
