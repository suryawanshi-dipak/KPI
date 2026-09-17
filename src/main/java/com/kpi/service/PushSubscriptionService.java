package com.kpi.service;

import com.kpi.dto.request.PushSubscriptionRequest;
import com.kpi.entity.PushSubscription;

import java.util.List;

public interface PushSubscriptionService {

    PushSubscription subscribe(Integer employeeId, PushSubscriptionRequest request, String userAgent);

    void unsubscribe(Integer employeeId, String endpoint);

    void revoke(String endpoint);

    void markSuccess(String endpoint);

    List<PushSubscription> getActiveSubscriptions(Integer employeeId);
}
