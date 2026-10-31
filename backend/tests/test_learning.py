"""
Unit tests for Sentry v2 Bayesian Learning Engine.
Tests Beta-Binomial posterior updates, time decay, credible intervals, and cold-start state.
"""
import pytest
from app.learning import (
    calculate_weight,
    calculate_credible_interval,
    is_cold_start_category,
    update_bayesian_weight,
    generate_why_shown_explanation,
    generate_taste_explanation,
    COLD_START_PRIORS
)


class TestBayesianWeightCalculations:
    def test_neutral_prior(self):
        """Alpha=5, Beta=5 should yield exactly 50% weight"""
        weight, pct = calculate_weight(5.0, 5.0)
        assert weight == 0.5
        assert pct == 50

    def test_skewed_accept_prior(self):
        """Alpha=22, Beta=3 (Security profile on api-gateway) should yield ~88%"""
        weight, pct = calculate_weight(22.0, 3.0)
        assert weight == pytest.approx(0.88, abs=0.01)
        assert pct == 88

    def test_skewed_dismiss_prior(self):
        """Alpha=4, Beta=14 (Style down-weighted) should yield ~22%"""
        weight, pct = calculate_weight(4.0, 14.0)
        assert weight == pytest.approx(0.22, abs=0.01)
        assert pct == 22

    def test_zero_safety(self):
        """Alpha=0, Beta=0 should fallback safely to 50%"""
        weight, pct = calculate_weight(0.0, 0.0)
        assert weight == 0.5
        assert pct == 50


class TestCredibleIntervals:
    def test_credible_interval_bounds(self):
        """90% CI lower should be < mean and upper > mean"""
        ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(20.0, 5.0)
        mean = 20.0 / 25.0  # 0.80
        assert 0.0 <= ci_l < mean < ci_u <= 1.0
        assert ci_lp < 80 < ci_up

    def test_low_data_wider_ci(self):
        """Low sample size (alpha=2, beta=2) should have wider interval than high sample size (alpha=50, beta=50)"""
        _, _, low_lp, low_up = calculate_credible_interval(2.0, 2.0)
        _, _, high_lp, high_up = calculate_credible_interval(50.0, 50.0)

        low_width = low_up - low_lp
        high_width = high_up - high_lp
        assert low_width > high_width, "Low data CI must be wider than high data CI"


class TestColdStartDetection:
    def test_cold_start_true_when_few_reviews(self):
        assert is_cold_start_category(accept_count=2, dismiss_count=1, not_relevant_count=0) is True
        assert is_cold_start_category(accept_count=0, dismiss_count=0, not_relevant_count=0) is True

    def test_cold_start_false_when_sufficient_reviews(self):
        assert is_cold_start_category(accept_count=4, dismiss_count=2, not_relevant_count=0) is False
        assert is_cold_start_category(accept_count=10, dismiss_count=5, not_relevant_count=0) is False


class TestTimeDecay:
    def test_update_bayesian_weight_accept(self):
        """Accepting should increase alpha and boost percentage"""
        new_a, new_b, weight, pct = update_bayesian_weight(
            current_alpha=5.0,
            current_beta=5.0,
            action="accept",
            apply_decay=False
        )
        assert new_a == 6.0
        assert new_b == 5.0
        assert pct > 50

    def test_update_bayesian_weight_dismiss(self):
        """Dismissing should increase beta and lower percentage"""
        new_a, new_b, weight, pct = update_bayesian_weight(
            current_alpha=5.0,
            current_beta=5.0,
            action="dismiss",
            apply_decay=False
        )
        assert new_a == 5.0
        assert new_b == 6.0
        assert pct < 50

    def test_update_bayesian_weight_with_decay(self):
        """Applying decay should decay previous empirical feedback toward baseline prior"""
        new_a, new_b, weight, pct = update_bayesian_weight(
            current_alpha=25.0,
            current_beta=5.0,
            action="accept",
            prior_alpha=5.0,
            prior_beta=5.0,
            apply_decay=True,
            decay_factor=0.90
        )
        # Empirical 20 decayed by 0.90 -> 18 + 5 prior = 23 + 1 accept = 24
        assert new_a == 24.0


class TestTransparencyExplainers:
    def test_generate_why_shown_explanation(self):
        explainer = generate_why_shown_explanation(
            category="security",
            weight=0.88,
            percentage=88,
            accept_count=22,
            dismiss_count=3,
            severity="critical",
            is_suppressed=False,
            ci_lower_pct=76,
            ci_upper_pct=95,
            is_cold_start=False
        )
        assert "Security" in explainer or "security" in explainer
        assert "88%" in explainer or "0.88" in explainer
        assert "Security" in explainer and "88%" in explainer
        assert "22 of 25" in explainer

    def test_taste_explanation_synthesis(self):
        sample_weights = [
            {"category": "security", "percentage": 88, "weight": 0.88, "alpha": 22, "beta": 3, "accept_count": 22, "dismiss_count": 3, "not_relevant_count": 0, "suppressed": False},
            {"category": "style", "percentage": 22, "weight": 0.22, "alpha": 4, "beta": 14, "accept_count": 4, "dismiss_count": 14, "not_relevant_count": 0, "suppressed": True},
            {"category": "best-practice", "percentage": 65, "weight": 0.65, "alpha": 15, "beta": 8, "accept_count": 15, "dismiss_count": 8, "not_relevant_count": 0, "suppressed": False}
        ]
        taste = generate_taste_explanation("api-gateway", sample_weights)
        assert "headline" in taste
        assert "summary" in taste
        assert "Security" in taste["priorities"]
        assert "Style" in taste["suppressed"]
        assert len(taste["category_breakdown"]) == 3
