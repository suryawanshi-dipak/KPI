package com.kpi.service.impl;

import com.kpi.dto.request.PerformanceReviewRequest;
import com.kpi.dto.response.PerformanceReviewResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.PerformanceReview;
import com.kpi.entity.enums.ReviewStatus;
import com.kpi.exception.BadRequestException;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.PerformanceReviewRepository;
import com.kpi.service.PerformanceReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PerformanceReviewServiceImpl implements PerformanceReviewService {

    private final PerformanceReviewRepository reviewRepository;
    private final EmployeeRepository employeeRepository;

    @Override
    public List<PerformanceReviewResponse> getAll() {
        return reviewRepository.findAllWithDetails().stream()
                .map(this::toResponse).toList();
    }

    @Override
    public PerformanceReviewResponse getById(Integer id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    public List<PerformanceReviewResponse> getByEmployeeId(Integer employeeId) {
        return reviewRepository.findByEmployeeIdWithDetails(employeeId).stream()
                .map(this::toResponse).toList();
    }

    @Override
    public List<PerformanceReviewResponse> getByStatus(ReviewStatus status) {
        return reviewRepository.findByStatusWithDetails(status).stream()
                .map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public PerformanceReviewResponse create(PerformanceReviewRequest request) {
        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getEmployeeId()));

        Employee reviewer = null;
        if (request.getReviewerId() != null) {
            reviewer = employeeRepository.findById(request.getReviewerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Reviewer", request.getReviewerId()));
        }

        PerformanceReview review = PerformanceReview.builder()
                .employee(employee)
                .reviewer(reviewer)
                .reviewType(request.getReviewType())
                .periodLabel(request.getPeriodLabel())
                .periodStart(request.getPeriodStart())
                .periodEnd(request.getPeriodEnd())
                .status(request.getStatus() != null ? request.getStatus() : ReviewStatus.draft)
                .kraComments(request.getKraComments())
                .overallScore(request.getOverallScore())
                .build();

        return toResponse(reviewRepository.save(review));
    }

    @Override
    @Transactional
    public PerformanceReviewResponse update(Integer id, PerformanceReviewRequest request) {
        PerformanceReview review = findOrThrow(id);

        if (review.getStatus() == ReviewStatus.approved) {
            throw new BadRequestException("Approved reviews cannot be modified");
        }

        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getEmployeeId()));

        Employee reviewer = null;
        if (request.getReviewerId() != null) {
            reviewer = employeeRepository.findById(request.getReviewerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Reviewer", request.getReviewerId()));
        }

        review.setEmployee(employee);
        review.setReviewer(reviewer);
        review.setReviewType(request.getReviewType());
        review.setPeriodLabel(request.getPeriodLabel());
        review.setPeriodStart(request.getPeriodStart());
        review.setPeriodEnd(request.getPeriodEnd());
        if (request.getStatus() != null) review.setStatus(request.getStatus());
        review.setKraComments(request.getKraComments());
        review.setOverallScore(request.getOverallScore());

        return toResponse(reviewRepository.save(review));
    }

    @Override
    @Transactional
    public PerformanceReviewResponse submit(Integer id) {
        PerformanceReview review = findOrThrow(id);
        if (review.getStatus() != ReviewStatus.draft) {
            throw new BadRequestException("Only draft reviews can be submitted");
        }
        review.setStatus(ReviewStatus.submitted);
        return toResponse(reviewRepository.save(review));
    }

    @Override
    @Transactional
    public PerformanceReviewResponse approve(Integer id) {
        PerformanceReview review = findOrThrow(id);
        if (review.getStatus() != ReviewStatus.submitted) {
            throw new BadRequestException("Only submitted reviews can be approved");
        }
        review.setStatus(ReviewStatus.approved);
        return toResponse(reviewRepository.save(review));
    }

    @Override
    @Transactional
    public void delete(Integer id) {
        PerformanceReview review = findOrThrow(id);
        if (review.getStatus() == ReviewStatus.approved) {
            throw new BadRequestException("Approved reviews cannot be deleted");
        }
        review.setIsDeleted(true);
        reviewRepository.save(review);
    }

    private PerformanceReview findOrThrow(Integer id) {
        return reviewRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Performance Review", id));
    }

    private PerformanceReviewResponse toResponse(PerformanceReview pr) {
        String empName = pr.getEmployee() != null ? resolveEmployeeName(pr.getEmployee()) : null;
        String reviewerName = pr.getReviewer() != null ? resolveEmployeeName(pr.getReviewer()) : null;

        return PerformanceReviewResponse.builder()
                .id(pr.getId())
                .employeeId(pr.getEmployee() != null ? pr.getEmployee().getId() : null)
                .employeeName(empName)
                .reviewerId(pr.getReviewer() != null ? pr.getReviewer().getId() : null)
                .reviewerName(reviewerName)
                .reviewType(pr.getReviewType())
                .periodLabel(pr.getPeriodLabel())
                .periodStart(pr.getPeriodStart())
                .periodEnd(pr.getPeriodEnd())
                .status(pr.getStatus())
                .kraComments(pr.getKraComments())
                .overallScore(pr.getOverallScore())
                .createdAt(pr.getCreatedAt())
                .updatedAt(pr.getUpdatedAt())
                .createdBy(pr.getCreatedBy())
                .updatedBy(pr.getUpdatedBy())
                .build();
    }

    private String resolveEmployeeName(Employee e) {
        if (e.getFirstName() != null) {
            String full = e.getFirstName();
            if (e.getLastName() != null) full += " " + e.getLastName();
            return full;
        }
        return e.getName() != null ? e.getName() : e.getEmail();
    }
}
