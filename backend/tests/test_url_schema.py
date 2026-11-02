from app.schemas.url_analysis import URLAnalyzeRequest


def test_url_request_schema():
    request = URLAnalyzeRequest(
        url="https://example.com",
        fetch_page=False,
        timeout=8,
    )

    assert str(request.url) == "https://example.com/"
    assert request.fetch_page is False
    assert request.timeout == 8
